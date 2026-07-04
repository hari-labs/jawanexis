from flask import Blueprint, jsonify, request
from collections import defaultdict
from bson import ObjectId
from datetime import datetime, timedelta, timezone
import os
import time

from utils.serializer import serialize_doc
from database.mongodb import (
    users_collection,
    sessions_collection,
    applications_collection,
    websites_collection,
    screenshots_collection,
    projects_collection,
    tasks_collection,
    task_evidence_collection,
    monitoring_states_collection,
    audit_logs_collection
)
from config.productivity_rules import (
    PRODUCTIVE_APPS,
    DISTRACTING_APPS,
    PRODUCTIVE_SITES,
    DISTRACTING_SITES,
    classify_app,
    classify_website,
    calculate_productivity_score,
    is_browser
)

reports_bp = Blueprint(
    "reports",
    __name__,
    url_prefix="/reports"
)

# ─────────────────────────────────────────────────
# Ownership Resolution Helpers
# ─────────────────────────────────────────────────

def _resolve_allowed_uids(caller_id, employee_id=None):
    """
    Returns a list of user ID strings that the caller is allowed to query.
    If employee_id is specified, verifies if caller is allowed to query that user,
    returning [employee_id] if allowed, else empty list [].
    """
    if not caller_id:
        if employee_id:
            return [employee_id]
        return None

    caller = None
    try:
        if ObjectId.is_valid(caller_id):
            caller = users_collection.find_one({"_id": ObjectId(caller_id)})
        else:
            caller = users_collection.find_one({"_id": caller_id})
    except Exception:
        pass

    if not caller:
        if employee_id:
            return [employee_id]
        return None

    caller_role = caller.get("role", "intern").lower()
    caller_uid = str(caller["_id"])

    if caller_role == "intern":
        return [caller_uid]
    elif caller_role in ["team_lead", "team lead"]:
        projects = list(projects_collection.find({
            "$or": [
                {"lead_id": caller_uid},
                {"lead_id": ObjectId(caller_uid) if ObjectId.is_valid(caller_uid) else caller_uid}
            ]
        }))
        allowed = set()
        for p in projects:
            for mid in p.get("member_ids", []):
                mid_str = str(mid)
                if mid_str != caller_uid:
                    allowed.add(mid_str)
        allowed_list = list(allowed)
        if employee_id:
            if employee_id in allowed_list or employee_id == caller_uid:
                return [employee_id]
            else:
                return []
        return allowed_list
    else:
        if employee_id:
            return [employee_id]
        return None

_RESOLVED_USER_IDS_CACHE = {}

def _resolve_user_ids(mongo_user_id: str):
    """
    Given a MongoDB user _id string, return the full set of IDs that
    might appear as 'user_id' in sessions/screenshots/applications.
    Covers: ObjectId, str(ObjectId), legacy int user_id.
    """
    mongo_user_id = str(mongo_user_id)
    if mongo_user_id in _RESOLVED_USER_IDS_CACHE:
        return _RESOLVED_USER_IDS_CACHE[mongo_user_id]

    ids = set()
    ids.add(mongo_user_id)
    try:
        ids.add(ObjectId(mongo_user_id))
    except Exception:
        pass
    # Also check if user has a legacy integer user_id field
    user = users_collection.find_one({"_id": ObjectId(mongo_user_id) if ObjectId.is_valid(mongo_user_id) else mongo_user_id})
    if user:
        legacy = user.get("user_id")
        if legacy is not None:
            ids.add(legacy)
            ids.add(str(legacy))
    res = list(ids)
    _RESOLVED_USER_IDS_CACHE[mongo_user_id] = res
    return res

def _get_user_sessions(mongo_user_id: str):
    """Return all sessions for a user, newest first."""
    ids = _resolve_user_ids(mongo_user_id)
    return list(sessions_collection.find({"user_id": {"$in": ids}}).sort("start_time", -1))

def _get_session_ids_for_user(mongo_user_id: str):
    """Return set of session ObjectIds for a user."""
    return {s["_id"] for s in _get_user_sessions(mongo_user_id)}

def _utc_to_local_ist(utc_str):
    if not utc_str:
        return None
    try:
        if utc_str.endswith("Z"):
            utc_str = utc_str[:-1] + "+00:00"
        dt = datetime.fromisoformat(utc_str)
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc)
        else:
            dt = dt.replace(tzinfo=timezone.utc)
        # Convert to IST (UTC+5:30)
        local_dt = dt + timedelta(minutes=330)
        return local_dt
    except Exception:
        return None

_SESSION_TELEMETRY_CACHE = {}






def _resolve_session_for_telemetry(doc, time_field="start_time", sessions_cache=None):
    """
    Resolve the session for an application/website/screenshot document.
    Tries ObjectId lookup first, then integer session_id → session map,
    then time-range overlap as fallback.
    """
    raw_sid = doc.get("session_id")
    if raw_sid is None:
        return None

    # Load from request cache if possible
    from flask import has_request_context, g
    if sessions_cache is None and has_request_context():
        uid = doc.get("user_id")
        if uid:
            uid_str = str(uid)
            if not hasattr(g, "sessions_cache_by_user"):
                g.sessions_cache_by_user = {}
            if uid_str in g.sessions_cache_by_user:
                sessions_cache = g.sessions_cache_by_user[uid_str]
            else:
                sessions_list = _get_user_sessions(uid_str)
                sessions_cache = {str(s["_id"]): s for s in sessions_list}
                sessions_cache["all_sessions"] = sessions_list
                g.sessions_cache_by_user[uid_str] = sessions_cache

    if sessions_cache is not None:
        sid_str = str(raw_sid)
        if sid_str in sessions_cache:
            return sessions_cache[sid_str]
        # Overlap fallback in cache
        event_time = doc.get(time_field)
        if event_time:
            all_sess = sessions_cache.get("all_sessions", [])
            for sess in all_sess:
                start_time = sess.get("start_time", "")
                if start_time and start_time <= event_time:
                    end_time = sess.get("end_time")
                    if not end_time or event_time <= end_time:
                        return sess
        return None

    # 1. Direct ObjectId lookup
    if isinstance(raw_sid, ObjectId):
        return sessions_collection.find_one({"_id": raw_sid})
    if isinstance(raw_sid, str) and len(raw_sid) == 24:
        try:
            return sessions_collection.find_one({"_id": ObjectId(raw_sid)})
        except Exception:
            pass

    # 2. Integer session_id — look up the synced session mapping
    event_time = doc.get(time_field)
    if not event_time:
        return None

    # Filter sessions strictly by the event's user to avoid cross-user telemetry leakage
    uid = doc.get("user_id")
    if not uid:
        return None
    resolved_ids = _resolve_user_ids(uid)

    # Find sessions whose time range overlaps with event_time
    candidates = list(
        sessions_collection.find({
            "user_id": {"$in": resolved_ids},
            "start_time": {"$lte": event_time}
        }).sort("start_time", -1).limit(20)
    )
    for sess in candidates:
        end_time = sess.get("end_time")
        if not end_time or event_time <= end_time:
            return sess
    return None

def aggregate_telemetry(user_id, scope, session_id=None, visibility_scope="INTERN_SCOPE", include_screenshots=True, compute_apps=True, compute_sites=True):
    """
    Consolidated shared aggregation helper using central productivity engine.
    """
    from config.productivity_rules import calculate_productivity, _resolve_user_ids, _utc_to_local_ist, classify_app, classify_website
    
    # 1. Resolve user IDs based on visibility_scope
    target_user_ids = []
    if visibility_scope == "TEAM_SCOPE":
        lead_oids = [user_id]
        if ObjectId.is_valid(user_id):
            lead_oids.append(ObjectId(user_id))
        led_projects = list(projects_collection.find({"lead_id": {"$in": lead_oids}}))
        team_member_ids = {str(user_id)}
        for p in led_projects:
            for mid in p.get("member_ids", []):
                team_member_ids.add(str(mid))
        target_user_ids = list(team_member_ids)
    elif visibility_scope == "ADMIN_SCOPE":
        all_users = list(users_collection.find({}, {"_id": 1}))
        target_user_ids = [str(u["_id"]) for u in all_users]
    else: # INTERN_SCOPE
        target_user_ids = [user_id]

    resolved_ids = []
    for uid in target_user_ids:
        resolved_ids.extend(_resolve_user_ids(uid))

    if not resolved_ids:
        return {
            "tracked_mins": 0.0,
            "active_mins": 0.0,
            "idle_mins": 0.0,
            "locked_mins": 0.0,
            "productive_mins": 0.0,
            "neutral_mins": 0.0,
            "unproductive_mins": 0.0,
            "efficiency_ratio": 0.0,
            "activity_ratio": 0.0,
            "productivity": 0,
            "apps": [],
            "sites": [],
            "screenshots": [],
            "screenshot_count": 0
        }

    # Query screenshots (for single user or multiple users, based on scope)
    today_local_dt = datetime.utcnow() + timedelta(minutes=330)
    today_prefix = today_local_dt.strftime("%Y-%m-%d")

    # Normalize scope names
    normalized_scope = scope
    if scope == "TODAY_SCOPE":
        normalized_scope = "TODAY"
    elif scope == "ALL_TIME_SCOPE":
        normalized_scope = "ALL_TIME"
    elif scope == "SESSION_SCOPE":
        normalized_scope = "SESSION"
    elif scope == "WEEK_SCOPE":
        normalized_scope = "WEEK"
    scope = normalized_scope

    screenshots_list = []
    if include_screenshots:
        # Screenshot query
        if normalized_scope == "SESSION" and session_id:
            session_ids_to_query = [session_id]
            if ObjectId.is_valid(str(session_id)):
                session_ids_to_query.append(ObjectId(str(session_id)))
            try:
                session_ids_to_query.append(int(str(session_id)))
            except (ValueError, TypeError):
                pass
            shot_query = {"session_id": {"$in": session_ids_to_query}}
        else:
            shot_query = {"user_id": {"$in": resolved_ids}}
    
        if normalized_scope == "TODAY":
            ist_start = datetime(today_local_dt.year, today_local_dt.month, today_local_dt.day, 0, 0, 0)
            utc_start = ist_start - timedelta(minutes=330)
            oldest_possible_utc = (utc_start - timedelta(days=1)).isoformat()
            shot_query["captured_at"] = {"$gte": oldest_possible_utc}
        elif normalized_scope == "WEEK":
            oldest_possible_utc = (today_local_dt - timedelta(days=8)).isoformat()
            shot_query["captured_at"] = {"$gte": oldest_possible_utc}
    
        shots = list(screenshots_collection.find(
            shot_query,
            {"session_id": 1, "captured_at": 1, "file_path": 1, "app_name": 1, "app": 1, "window_title": 1, "uploaded_to_cloud": 1, "cloudinary_url": 1, "user_id": 1}
        ).sort("captured_at", -1))
    
        all_sessions = list(sessions_collection.find({"user_id": {"$in": resolved_ids}}).sort("start_time", -1))
        sessions_cache = {str(s["_id"]): s for s in all_sessions}
        sessions_cache["all_sessions"] = all_sessions
    
        filtered_shots = []
        for shot in shots:
            if normalized_scope == "TODAY":
                local_dt = _utc_to_local_ist(shot.get("captured_at"))
                if not local_dt or local_dt.strftime("%Y-%m-%d") != today_prefix:
                    continue
            elif normalized_scope == "WEEK":
                local_dt = _utc_to_local_ist(shot.get("captured_at"))
                if not local_dt:
                    continue
                date_diff = (today_local_dt - local_dt).days
                if date_diff < 0 or date_diff >= 7:
                    continue
            elif normalized_scope == "SESSION" and session_id:
                sess = _resolve_session_for_telemetry(shot, time_field="captured_at", sessions_cache=sessions_cache)
                if not sess or str(sess["_id"]) != str(session_id):
                    continue
            filtered_shots.append(shot)
    
        for shot in filtered_shots:
            fmt_shot = _format_screenshot(shot)
            if fmt_shot:
                screenshots_list.append(fmt_shot)

    # 2. Call the Central Productivity Engine
    # If single user, delegate directly to avoid duplicate logic
    if visibility_scope == "INTERN_SCOPE" and len(target_user_ids) == 1:
        uid = target_user_ids[0]
        # Pass session_id if scope is SESSION
        engine_scope = session_id if normalized_scope == "SESSION" else normalized_scope
        res = calculate_productivity(uid, engine_scope)
        
        apps_list = []
        if compute_apps:
            for app in res["productive_apps"] + res["neutral_apps"] + res["unproductive_apps"]:
                apps_list.append({
                    "name": app["name"],
                    "duration": app["duration"],
                    "percentage": app["percentage"],
                    "category": "distracting" if app["category"] == "unproductive" else app["category"]
                })
        sites_list = []
        if compute_sites:
            for site in res["productive_sites"] + res["neutral_sites"] + res["unproductive_sites"]:
                sites_list.append({
                    "domain": site["domain"],
                    "duration": site["duration"],
                    "percentage": site["percentage"],
                    "category": "distracting" if site["category"] == "unproductive" else site["category"]
                })

        return {
            "tracked_mins": round(res["tracked_minutes"], 1),
            "active_mins": round(res["active_minutes"], 1),
            "idle_mins": round(res["idle_minutes"], 1),
            "locked_mins": round(res["locked_minutes"], 1),
            "productive_mins": round(res["productive_minutes"], 1),
            "neutral_mins": round(res["neutral_minutes"], 1),
            "unproductive_mins": round(res["unproductive_minutes"], 1),
            "efficiency_ratio": res["efficiency_ratio"],
            "activity_ratio": res["activity_ratio"],
            "productivity": res["productivity"],
            "apps": apps_list,
            "sites": sites_list,
            "screenshots": screenshots_list,
            "screenshot_count": len(screenshots_list)
        }

    # Multiple users: average percentages/ratios and sum minutes
    user_scores = []
    user_efficiencies = []
    user_activities = []
    
    total_prod_mins = 0.0
    total_neutral_mins = 0.0
    total_unprod_mins = 0.0
    total_idle_mins = 0.0
    total_locked_mins = 0.0
    total_tracked_mins = 0.0
    total_active_mins = 0.0
    
    app_durations = defaultdict(int)
    site_durations = defaultdict(int)
    
    for uid in target_user_ids:
        engine_scope = session_id if normalized_scope == "SESSION" else normalized_scope
        user_res = calculate_productivity(uid, engine_scope)
        if user_res["tracked_minutes"] > 0:
            user_scores.append(user_res["productivity"])
            user_efficiencies.append(user_res["efficiency_ratio"])
            user_activities.append(user_res["activity_ratio"])
            
            total_prod_mins += user_res["productive_minutes"]
            total_neutral_mins += user_res["neutral_minutes"]
            total_unprod_mins += user_res["unproductive_minutes"]
            total_idle_mins += user_res["idle_minutes"]
            total_locked_mins += user_res["locked_minutes"]
            total_tracked_mins += user_res["tracked_minutes"]
            total_active_mins += user_res["active_minutes"]
            
            for app in user_res["productive_apps"] + user_res["neutral_apps"] + user_res["unproductive_apps"]:
                app_durations[app["name"]] += app["duration"]
            for site in user_res["productive_sites"] + user_res["neutral_sites"] + user_res["unproductive_sites"]:
                site_durations[site["domain"]] += site["duration"]

    productivity = int(round(sum(user_scores) / len(user_scores))) if user_scores else 0
    efficiency_ratio = round(sum(user_efficiencies) / len(user_efficiencies), 4) if user_efficiencies else 0.0
    activity_ratio = round(sum(user_activities) / len(user_activities), 4) if user_activities else 0.0
    
    apps_list = []
    if compute_apps:
        total_app_sec = sum(app_durations.values())
        for name, dur in app_durations.items():
            pct = round((dur / total_app_sec) * 100) if total_app_sec > 0 else 0
            cat = classify_app(name)
            category = "distracting" if cat == "unproductive" else cat
            apps_list.append({"name": name, "duration": dur, "percentage": pct, "category": category})
        apps_list.sort(key=lambda x: x["duration"], reverse=True)
    
    sites_list = []
    if compute_sites:
        total_site_sec = sum(site_durations.values())
        for domain, dur in site_durations.items():
            pct = round((dur / total_site_sec) * 100) if total_site_sec > 0 else 0
            cat = classify_website(domain)
            category = "distracting" if cat == "unproductive" else cat
            sites_list.append({"domain": domain, "duration": dur, "percentage": pct, "category": category})
        sites_list.sort(key=lambda x: x["duration"], reverse=True)

    return {
        "tracked_mins": round(total_tracked_mins, 1),
        "active_mins": round(total_active_mins, 1),
        "idle_mins": round(total_idle_mins, 1),
        "locked_mins": round(total_locked_mins, 1),
        "productive_mins": round(total_prod_mins, 1),
        "neutral_mins": round(total_neutral_mins, 1),
        "unproductive_mins": round(total_unprod_mins, 1),
        "efficiency_ratio": efficiency_ratio,
        "activity_ratio": activity_ratio,
        "productivity": productivity,
        "apps": apps_list,
        "sites": sites_list,
        "screenshots": screenshots_list,
        "screenshot_count": len(screenshots_list)
    }

def _build_user_summary(user):
    """Build full stats summary for a user."""
    uid = str(user["_id"])
    stats = aggregate_telemetry(uid, "ALL_TIME_SCOPE", include_screenshots=False)

    all_sessions = _get_user_sessions(uid)
    latest_session = all_sessions[0] if all_sessions else None
    state_doc = monitoring_states_collection.find_one({"user_id": uid})

    # currentApp / currentSite
    current_app = "-"
    current_site = "-"
    if latest_session:
        sess_id = latest_session["_id"]
        app_doc = applications_collection.find_one(
            {"session_id": {"$in": [sess_id, str(sess_id)]}},
            sort=[("start_time", -1)]
        )
        if not app_doc:
            app_doc = applications_collection.find_one(
                {"user_id": uid},
                sort=[("start_time", -1)]
            )
        if app_doc:
            current_app = app_doc.get("app_name") or app_doc.get("application_name") or "-"

        site_doc = websites_collection.find_one(
            {"session_id": {"$in": [sess_id, str(sess_id)]}},
            sort=[("start_time", -1)]
        )
        if not site_doc:
            site_doc = websites_collection.find_one(
                {"user_id": uid},
                sort=[("start_time", -1)]
            )
        if site_doc:
            current_site = site_doc.get("website") or site_doc.get("domain") or "-"

    # Avatar color palette
    palette = [
        "oklch(0.6 0.18 12)",
        "oklch(0.6 0.16 120)",
        "oklch(0.55 0.22 295)",
        "oklch(0.65 0.18 200)",
        "oklch(0.7 0.15 70)",
        "oklch(0.55 0.18 340)"
    ]
    avatar_color = palette[hash(str(user["_id"])) % len(palette)]
    joined_date = (user.get("created_at") or "")[:10] or "-"

    status = "offline"
    if state_doc:
        state = state_doc.get("current_state", "STOPPED")
        lh = state_doc.get("last_heartbeat")
        online = False
        if lh:
            try:
                dt = datetime.fromisoformat(lh)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                online = (datetime.now(timezone.utc) - dt).total_seconds() < 30
            except Exception:
                pass
        if online and state == "RUNNING":
            status = "active"
        elif state == "PAUSED":
            status = "paused"
    if status == "offline" and latest_session:
        raw = latest_session.get("status", "offline").upper()
        if raw in ("ACTIVE", "RUNNING"):
            status = "active"
        elif raw == "PAUSED":
            status = "paused"

    return {
        "id": uid,
        "name": user["name"],
        "email": user["email"],
        "role": user.get("role", "intern"),
        "status": status,
        "workHours": round(stats["active_mins"] / 60, 1),
        "breakHours": round(stats["idle_mins"] / 60, 1),
        "currentApp": current_app,
        "currentSite": current_site,
        "lastActive": latest_session.get("start_time", "-") if latest_session else "-",
        "productivity": stats["productivity"],
        "task": user.get("task", None),
        "avatarColor": avatar_color,
        "timezone": user.get("timezone", "IST"),
        "joinedDate": joined_date
    }


# ─────────────────────────────────────────────────
# Meaningful Activity Feed (monitoring + task events)
# ─────────────────────────────────────────────────

@reports_bp.route("/recent-activity", methods=["GET"])
def get_recent_activity():
    employee_id = request.args.get("employee_id") or request.args.get("user_id")
    events = []

    # Build user map: _id str → user doc
    user_map = {}
    for u in users_collection.find():
        user_map[str(u["_id"])] = u

    # ── 1. Monitoring state events ──────────────────
    # Pull from audit_logs if available
    monitoring_query = {"action": {"$in": ["MONITORING_STARTED", "MONITORING_STOPPED"]}}
    if employee_id:
        monitoring_query["$or"] = [
            {"user_id": employee_id},
            {"user_id": ObjectId(employee_id) if ObjectId.is_valid(employee_id) else employee_id}
        ]
    monitoring_events = list(audit_logs_collection.find(monitoring_query).sort("timestamp", -1).limit(200))

    for ev in monitoring_events:
        uid = str(ev.get("user_id", ""))
        user = user_map.get(uid)
        if not user:
            continue
        label_map = {
            "MONITORING_STARTED": "Monitoring Started",
            "MONITORING_STOPPED": "Monitoring Stopped",
        }
        events.append({
            "internId": uid,
            "intern": user["name"],
            "action": label_map.get(ev["action"], ev["action"]),
            "detail": "",
            "time": ev.get("timestamp", ""),
            "type": "monitoring"
        })

    # ── 2. Task assignment events ───────────────────
    task_query = {"created_at": {"$exists": True}}
    if employee_id:
        task_query["$or"] = [
            {"assigned_to": employee_id},
            {"assigned_to": ObjectId(employee_id) if ObjectId.is_valid(employee_id) else employee_id},
            {"assigned_by": employee_id},
            {"assigned_by": ObjectId(employee_id) if ObjectId.is_valid(employee_id) else employee_id}
        ]
    task_events = list(tasks_collection.find(task_query).sort("created_at", -1).limit(100))

    for t in task_events:
        assigned_to = str(t.get("assigned_to", ""))
        assigned_by = str(t.get("assigned_by", ""))
        user = user_map.get(assigned_to) or user_map.get(assigned_by)
        if not user:
            continue
        events.append({
            "internId": assigned_to or assigned_by,
            "intern": user["name"],
            "action": "Task Assigned",
            "detail": t.get("title", ""),
            "time": t.get("created_at", ""),
            "type": "task"
        })

    # ── 3. Evidence / Task submission events ────────
    evidence_query = {}
    if employee_id:
        evidence_query["$or"] = [
            {"uploaded_by": employee_id},
            {"uploaded_by": ObjectId(employee_id) if ObjectId.is_valid(employee_id) else employee_id}
        ]
    evidence_events = list(task_evidence_collection.find(evidence_query).sort("uploaded_at", -1).limit(100))

    for ev in evidence_events:
        uid = str(ev.get("uploaded_by", ""))
        user = user_map.get(uid)
        if not user:
            continue

        sub_time = ev.get("submitted_at") or ev.get("uploaded_at") or ""
        # Evidence Uploaded
        events.append({
            "internId": uid,
            "intern": user["name"],
            "action": "Evidence Uploaded",
            "detail": ev.get("notes", "") or "",
            "time": sub_time,
            "type": "evidence"
        })

        ev_status = ev.get("status", "pending")
        review_time = ev.get("reviewed_at") or ""
        if ev_status == "approved":
            events.append({
                "internId": uid,
                "intern": user["name"],
                "action": "Task Completed",
                "detail": ev.get("review_comments", "") or "",
                "time": review_time or sub_time,
                "type": "evidence"
            })

    # ── 4. Project events (Project Assigned) ──
    project_query = {"created_at": {"$exists": True}}
    if employee_id:
        project_query["member_ids"] = {"$in": [
            employee_id,
            ObjectId(employee_id) if ObjectId.is_valid(employee_id) else employee_id
        ]}
    project_events = list(projects_collection.find(project_query).sort("created_at", -1).limit(50))

    for p in project_events:
        created_time = p.get("created_at", "")
        # Project Assigned (associated with each member)
        for mid in p.get("member_ids", []):
            mid_str = str(mid)
            user = user_map.get(mid_str)
            if user:
                if not employee_id or mid_str == employee_id:
                    events.append({
                        "internId": mid_str,
                        "intern": user["name"],
                        "action": "Project Assigned",
                        "detail": f"Assigned to {p.get('name', '')}",
                        "time": created_time,
                        "type": "project"
                    })

    # Filter strictly to the whitelisted actions
    ALLOWED_ACTIONS = {"Monitoring Started", "Monitoring Stopped", "Task Assigned", "Task Completed", "Evidence Uploaded", "Project Assigned"}
    filtered_events = [e for e in events if e["action"] in ALLOWED_ACTIONS]

    # Sort by time descending, assign IDs
    filtered_events.sort(key=lambda e: (e.get("time") or ""), reverse=True)
    for i, event in enumerate(filtered_events[:50]):
        event["id"] = i + 1

    return jsonify(filtered_events[:50])


# ─────────────────────────────────────────────────
# User Summary (all users)
# ─────────────────────────────────────────────────

@reports_bp.route("/user-summary", methods=["GET"])
def get_user_summary():
    summaries = []
    for user in users_collection.find():
        summaries.append(_build_user_summary(user))
    return jsonify(summaries)


# ─────────────────────────────────────────────────
# Intern Detail Summary
# ─────────────────────────────────────────────────

@reports_bp.route("/intern-summary/<user_id>", methods=["GET"])
def get_intern_summary(user_id, dashboard=False, activity_page=False):
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
        if not user:
            return jsonify({"error": "User not found"}), 404

        uid = str(user["_id"])
        
        from flask import request
        if request and not dashboard:
            # If called directly as an API endpoint, it's the activity page context
            if getattr(request, "endpoint", None) == "reports.get_intern_summary":
                activity_page = True

        state_doc = monitoring_states_collection.find_one({"user_id": uid})
        all_sessions = _get_user_sessions(uid)
        session_id_filter = request.args.get("session_id") if request else None

        include_shots = not dashboard
        if dashboard:
            stats = {
                "tracked_mins": 0.0,
                "active_mins": 0.0,
                "idle_mins": 0.0,
                "locked_mins": 0.0,
                "productive_mins": 0.0,
                "neutral_mins": 0.0,
                "unproductive_mins": 0.0,
                "efficiency_ratio": 0.0,
                "activity_ratio": 0.0,
                "productivity": 0,
                "apps": [],
                "sites": [],
                "screenshots": [],
                "screenshot_count": 0
            }
        elif session_id_filter in ("today", "TODAY_SCOPE"):
            stats = aggregate_telemetry(uid, "TODAY_SCOPE", include_screenshots=include_shots)
        elif session_id_filter in ("week", "WEEK_SCOPE"):
            stats = aggregate_telemetry(uid, "WEEK_SCOPE", include_screenshots=include_shots)
        elif session_id_filter and session_id_filter not in ("all", "ALL_TIME_SCOPE", ""):
            stats = aggregate_telemetry(uid, "SESSION_SCOPE", session_id=session_id_filter, include_screenshots=include_shots)
        else:
            stats = aggregate_telemetry(uid, "ALL_TIME_SCOPE", include_screenshots=include_shots)

        # Always calculate today's telemetry stats for the today fields
        today_stats = aggregate_telemetry(uid, "TODAY_SCOPE", include_screenshots=include_shots)

        apps_list = stats["apps"]
        sites_list = stats["sites"]
        total_active_mins = stats["active_mins"]
        total_idle_mins = stats["idle_mins"]
        total_work_mins = stats["tracked_mins"]
        productivity = stats["productivity"]
        screenshots_list = stats["screenshots"]
        screenshot_count = stats["screenshot_count"]

        today_apps_list = [{
            "name": app["name"],
            "duration": app["duration"],
            "percentage": app.get("percentage", 0),
            "category": app.get("category", "neutral")
        } for app in today_stats["apps"]]
        today_sites_list = [{
            "domain": site["domain"],
            "duration": site["duration"],
            "percentage": site.get("percentage", 0),
            "category": site.get("category", "neutral")
        } for site in today_stats["sites"]]
        today_screenshots = today_stats["screenshots"]
        today_active_mins = today_stats["active_mins"]
        today_idle_mins = today_stats["idle_mins"]
        today_work_mins_val = today_stats["tracked_mins"]
        today_productivity = today_stats["productivity"]
        today_work_hours = round(today_active_mins / 60, 2)
        today_break_hours = round(today_idle_mins / 60, 2)

        # ── Projects & Tasks ───────────────────────
        user_oids = [uid]
        if ObjectId.is_valid(uid):
            user_oids.append(ObjectId(uid))

        role = user.get("role", "intern").lower()
        
        projects_list = []
        project_count = 0
        task_count = 0
        completed_tasks_count = 0

        if activity_page:
            pass
        elif dashboard:
            if role in ["team_lead", "team lead"]:
                project_count = projects_collection.count_documents({"lead_id": {"$in": user_oids}})
            else:
                project_count = projects_collection.count_documents({"member_ids": {"$in": user_oids}})
            
            task_count = tasks_collection.count_documents({"assigned_to": {"$in": user_oids}})
            completed_tasks_count = tasks_collection.count_documents({
                "assigned_to": {"$in": user_oids},
                "status": {"$in": ["Completed", "Approved", "completed", "approved"]}
            })
        else:
            if role in ["team_lead", "team lead"]:
                projects_full = list(projects_collection.find({"lead_id": {"$in": user_oids}}))
            else:
                projects_full = list(projects_collection.find({"member_ids": {"$in": user_oids}}))
            projects_list = [{"id": str(p["_id"]), "name": p.get("name", "")} for p in projects_full]
            project_count = len(projects_full)
            
            user_tasks = list(tasks_collection.find({"assigned_to": {"$in": user_oids}}))
            task_count = len(user_tasks)
            completed_tasks_count = sum(1 for t in user_tasks if t.get("status") in ("Completed", "Approved", "completed", "approved"))

        # ── Session history ────────────────────────
        serialized_sessions = []
        from config.productivity_rules import calculate_productivity
        
        # DEMO OPTIMIZATION: Limit productivity calculation loops
        # Dashboard only needs top-level stats, not historical sessions.
        # Intern page can just show the last 3 sessions to stay under Render's 30s timeout.
        calc_limit = 0 if dashboard else 3

        for i, s in enumerate(all_sessions[:20]):
            if i < calc_limit:
                sess_res = calculate_productivity(uid, str(s["_id"]))
                serialized_sessions.append({
                    "id": str(s["_id"]),
                    "start_time": s.get("start_time", ""),
                    "end_time": s.get("end_time", ""),
                    "active_minutes": round(sess_res["active_minutes"], 1),
                    "idle_minutes": round(sess_res["idle_minutes"], 1),
                    "locked_minutes": round(sess_res["locked_minutes"], 1),
                    "productivity": sess_res["productivity"],
                    "status": s.get("status", "ENDED")
                })
            else:
                serialized_sessions.append({
                    "id": str(s["_id"]),
                    "start_time": s.get("start_time", ""),
                    "end_time": s.get("end_time", ""),
                    "active_minutes": 0.0,
                    "idle_minutes": 0.0,
                    "locked_minutes": 0.0,
                    "productivity": 0,
                    "status": s.get("status", "ENDED")
                })

        # ── Avatar color ───────────────────────────
        palette = [
            "oklch(0.6 0.18 12)",
            "oklch(0.6 0.16 120)",
            "oklch(0.55 0.22 295)",
            "oklch(0.65 0.18 200)",
            "oklch(0.7 0.15 70)",
            "oklch(0.55 0.18 340)"
        ]
        avatar_color = palette[hash(uid) % len(palette)]
        joined_date = (user.get("created_at") or "")[:10] or "-"

        latest_session = all_sessions[0] if all_sessions else None
        status = "offline"
        if state_doc:
            state = state_doc.get("current_state", "STOPPED")
            lh = state_doc.get("last_heartbeat")
            online = False
            if lh:
                try:
                    dt = datetime.fromisoformat(lh)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    online = (datetime.now(timezone.utc) - dt).total_seconds() < 30
                except Exception:
                    pass
            if online and state == "RUNNING":
                status = "active"
            elif state == "PAUSED":
                status = "paused"
        if status == "offline" and latest_session:
            raw = latest_session.get("status", "offline").upper()
            if raw in ("ACTIVE", "RUNNING"):
                status = "active"
            elif raw == "PAUSED":
                status = "paused"

        # Current app / site from latest session
        current_app = "-"
        current_site = "-"
        if latest_session:
            sess_oid = latest_session["_id"]
            app_doc = applications_collection.find_one(
                {"session_id": {"$in": [sess_oid, str(sess_oid)]}},
                sort=[("start_time", -1)]
            )
            if app_doc:
                current_app = app_doc.get("application_name") or app_doc.get("app_name") or "-"
            site_doc = websites_collection.find_one(
                {"session_id": {"$in": [sess_oid, str(sess_oid)]}},
                sort=[("start_time", -1)]
            )
            if site_doc:
                current_site = site_doc.get("domain") or site_doc.get("website") or "-"

        # ── Team Lead analytics ────────────────────
        team_stats = None
        if role in ["team_lead", "team lead"] and not dashboard:
            team_stats = _build_team_lead_stats(uid, user)

        summary = {
            "id": uid,
            "name": user["name"],
            "email": user["email"],
            "role": role,
            "status": status,
            "workHours": round(total_active_mins / 60, 1),
            "breakHours": round(total_idle_mins / 60, 1),
            "workHoursToday": today_work_hours,
            "breakHoursToday": today_break_hours,
            "productivityToday": today_productivity,
            "completedTasksCount": completed_tasks_count,
            "currentApp": current_app,
            "currentSite": current_site,
            "lastActive": latest_session.get("start_time", "-") if latest_session else "-",
            "productivity": productivity,
            "task": user.get("task", None),
            "avatarColor": avatar_color,
            "timezone": user.get("timezone", "IST"),
            "joinedDate": joined_date,
            # Explainable today's metrics
            "today_productive_mins": round(today_stats.get("productive_mins", 0.0), 1),
            "today_neutral_mins": round(today_stats.get("neutral_mins", 0.0), 1),
            "today_unproductive_mins": round(today_stats.get("unproductive_mins", 0.0), 1),
            "today_locked_mins": round(today_stats.get("locked_mins", 0.0), 1),
            "today_idle_mins": round(today_stats.get("idle_mins", 0.0), 1),
            "today_efficiency": round((today_stats.get("efficiency_ratio", 0.0) * 100.0), 1),
            "today_activity_ratio": round((today_stats.get("activity_ratio", 0.0) * 100.0), 1),

            # Explainable total/historical metrics
            "total_productive_mins": round(stats.get("productive_mins", 0.0), 1),
            "total_neutral_mins": round(stats.get("neutral_mins", 0.0), 1),
            "total_unproductive_mins": round(stats.get("unproductive_mins", 0.0), 1),
            "total_locked_mins": round(stats.get("locked_mins", 0.0), 1),
            "total_idle_mins": round(stats.get("idle_mins", 0.0), 1),
            "total_efficiency": round((stats.get("efficiency_ratio", 0.0) * 100.0), 1),
            "total_activity_ratio": round((stats.get("activity_ratio", 0.0) * 100.0), 1),

            # Scope-specific explainable metrics
            "scope_tracked_mins": round(stats.get("tracked_mins", 0.0), 1),
            "scope_active_mins": round(stats.get("active_mins", 0.0), 1),
            "scope_idle_mins": round(stats.get("idle_mins", 0.0), 1),
            "scope_locked_mins": round(stats.get("locked_mins", 0.0), 1),
            "scope_productive_mins": round(stats.get("productive_mins", 0.0), 1),
            "scope_neutral_mins": round(stats.get("neutral_mins", 0.0), 1),
            "scope_unproductive_mins": round(stats.get("unproductive_mins", 0.0), 1),
            "scope_efficiency": round((stats.get("efficiency_ratio", 0.0) * 100.0), 1),
            "scope_activity_ratio": round((stats.get("activity_ratio", 0.0) * 100.0), 1),
            "scope_productivity": stats.get("productivity", 0),

            # Rich analytics
            "total_active_mins": round(total_active_mins, 1),
            "total_idle_mins": round(total_idle_mins, 1),
            "total_work_mins": round(total_work_mins, 1),
            "today_active_mins": round(today_active_mins, 1),
            "today_idle_mins": round(today_idle_mins, 1),
            "today_work_mins": round(today_work_mins_val, 1),
            "apps": apps_list,
            "sites": sites_list,
            "today_apps": today_apps_list,
            "today_sites": today_sites_list,
            "today_screenshots": today_screenshots[:24],
            "screenshot_count": screenshot_count,
            "screenshots": screenshots_list[:24],
            "app_count": len(apps_list),
            "site_count": len(sites_list),
            "sessions": serialized_sessions,
            "project_count": project_count,
            "task_count": task_count,
            "projects": projects_list,
        }
        if team_stats:
            summary["team_stats"] = team_stats

        return jsonify(summary)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 400


_user_names_cache = {}

def _get_cached_user_name(uid):
    if not uid:
        return "Unknown"
    uid_str = str(uid)
    if uid_str not in _user_names_cache:
        try:
            user = users_collection.find_one({"_id": ObjectId(uid_str) if ObjectId.is_valid(uid_str) else uid_str})
            _user_names_cache[uid_str] = user.get("name", "Unknown") if user else "Unknown"
        except Exception:
            _user_names_cache[uid_str] = "Unknown"
    return _user_names_cache[uid_str]


def _format_screenshot(shot):
    fp = shot.get("file_path", "")
    if fp:
        fp = "screenshots/" + os.path.basename(fp)
        
    app_name = shot.get("app_name") or shot.get("app")
    if not app_name or app_name == "Unknown":
        app_name = "No Application Metadata"
        
    window_title = shot.get("window_title") or ""
    if window_title == "Unknown":
        window_title = ""
        
    uploaded_to_cloud = shot.get("uploaded_to_cloud", False)
    cloudinary_url = shot.get("cloudinary_url")

    # Check if file actually exists on disk (bypass if uploaded to cloud)
    if not (uploaded_to_cloud and cloudinary_url):
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        actual_path = os.path.join(backend_dir, fp) if fp else ""
        if not actual_path or not os.path.exists(actual_path):
            return None

    uid = shot.get("user_id")
    user_name = _get_cached_user_name(uid) if uid else "Unknown"

    return {
        "id": str(shot["_id"]),
        "captured_at": shot.get("captured_at", ""),
        "app_name": app_name,
        "window_title": window_title,
        "activity": shot.get("activity", 90),
        "file_path": fp,
        "user_id": str(uid) if uid else "",
        "user_name": user_name,
        "session_id": str(shot.get("session_id", "Unknown")),
        "cloudinary_url": cloudinary_url,
        "uploaded_to_cloud": uploaded_to_cloud
    }


def _build_team_lead_stats(lead_id: str, lead_user: dict, scope: str = "ALL_TIME_SCOPE"):
    """Build analytics for a team lead view."""
    lead_oids = [lead_id]
    if ObjectId.is_valid(lead_id):
        lead_oids.append(ObjectId(lead_id))
    led_projects = list(projects_collection.find({"lead_id": {"$in": lead_oids}}))

    # Gather all member IDs (excluding lead)
    all_member_ids = set()
    for p in led_projects:
        for mid in p.get("member_ids", []):
            mid_str = str(mid)
            if mid_str != lead_id:
                all_member_ids.add(mid_str)

    members = list(users_collection.find({"_id": {"$in": [
        ObjectId(m) if ObjectId.is_valid(m) else m for m in all_member_ids
    ]}}))

    member_ids_str = [str(m["_id"]) for m in members]

    # Preload monitoring states
    all_states = list(monitoring_states_collection.find({"user_id": {"$in": member_ids_str}}))
    states_cache = {str(doc["user_id"]): doc for doc in all_states}

    # Monitoring statuses for member states list
    member_states = []
    for m in members:
        uid = str(m["_id"])
        state_doc = states_cache.get(uid)
        state = state_doc.get("current_state", "STOPPED") if state_doc else "STOPPED"
        online = False
        if state_doc:
            lh = state_doc.get("last_heartbeat")
            if lh:
                try:
                    from datetime import datetime, timezone
                    dt = datetime.fromisoformat(lh)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    online = (datetime.now(timezone.utc) - dt).total_seconds() < 30
                except Exception:
                    pass
        member_states.append({
            "id": uid,
            "name": m.get("name", ""),
            "state": state,
            "online": online
        })

    active_members = sum(1 for ms in member_states if ms["state"] == "RUNNING")

    # Tasks
    project_ids = [str(p["_id"]) for p in led_projects]
    team_tasks = list(tasks_collection.find({"project_id": {"$in": project_ids}}))

    pending_tasks = sum(1 for t in team_tasks if t.get("status") in ("Pending", "pending", "todo"))
    in_progress_tasks = sum(1 for t in team_tasks if t.get("status") in ("In Progress", "in_progress"))
    done_tasks = sum(1 for t in team_tasks if t.get("status") in ("Completed", "completed", "done", "Approved", "approved"))

    # Team Telemetry via TEAM_SCOPE
    team_historical = aggregate_telemetry(lead_id, scope, visibility_scope="TEAM_SCOPE")
    team_today = aggregate_telemetry(lead_id, "TODAY_SCOPE", visibility_scope="TEAM_SCOPE")

    return {
        "led_project_count": len(led_projects),
        "managed_member_count": len(members),
        "active_members": active_members,
        "team_productivity": team_historical["productivity"],
        "team_active_mins": round(team_historical["active_mins"], 2),
        "team_idle_mins": round(team_historical["idle_mins"], 2),
        "team_apps_count": len(team_historical["apps"]),
        "team_sites_count": len(team_historical["sites"]),
        "team_task_count": len(team_tasks),
        "pending_tasks": pending_tasks,
        "in_progress_tasks": in_progress_tasks,
        "done_tasks": done_tasks,
        "team_screenshot_count": team_historical["screenshot_count"],
        "member_monitoring": member_states,
        "team_apps": team_historical["apps"],
        "team_sites": team_historical["sites"],
        "team_today_apps": team_today["apps"],
        "team_today_sites": team_today["sites"],
        "team_today_active_mins": round(team_today["active_mins"], 2),
        "team_today_idle_mins": round(team_today["idle_mins"], 2),
        "team_today_productivity": team_today["productivity"]
    }


# ─────────────────────────────────────────────────
# Screenshot Report (grouped by hour)
# ─────────────────────────────────────────────────

@reports_bp.route("/screenshots", methods=["GET"])
def get_screenshot_report():
    employee_id = request.args.get("employee_id") or request.args.get("user_id")
    date = request.args.get("date")

    caller_id = request.headers.get("X-User-Id")
    caller = None
    if caller_id:
        try:
            if ObjectId.is_valid(caller_id):
                caller = users_collection.find_one({"_id": ObjectId(caller_id)})
            else:
                caller = users_collection.find_one({"_id": caller_id})
        except Exception:
            pass

    caller_role = "admin"
    if caller:
        caller_role = caller.get("role", "intern").lower()

    allowed_uids = None

    if caller_role == "intern":
        allowed_uids = [str(caller["_id"])]
        if not employee_id:
            employee_id = str(caller["_id"])
        elif employee_id != str(caller["_id"]):
            employee_id = str(caller["_id"])
    elif caller_role in ["team_lead", "team lead"]:
        lead_uid = str(caller["_id"])
        projects = list(projects_collection.find({
            "$or": [
                {"lead_id": lead_uid},
                {"lead_id": ObjectId(lead_uid) if ObjectId.is_valid(lead_uid) else lead_uid}
            ]
        }))
        allowed_uids = {lead_uid}
        for p in projects:
            for mid in p.get("member_ids", []):
                allowed_uids.add(str(mid))
        allowed_uids = list(allowed_uids)
        if employee_id:
            if employee_id not in allowed_uids:
                employee_id = lead_uid
    else:
        # Admin: no restrictions
        if employee_id:
            allowed_uids = [employee_id]

    query = {}
    if date:
        try:
            dt = datetime.strptime(date, "%Y-%m-%d")
            prev_date = (dt - timedelta(days=1)).strftime("%Y-%m-%d")
            next_date = (dt + timedelta(days=1)).strftime("%Y-%m-%d")
            query["captured_at"] = {"$regex": f"^({prev_date}|{date}|{next_date})"}
        except Exception:
            query["captured_at"] = {"$regex": f"^{date}"}

    raw_shots = list(screenshots_collection.find(query).sort("captured_at", -1))
    
    # Dynamically resolve and backfill user_id on the fly if missing
    for shot in raw_shots:
        if "user_id" not in shot or not shot["user_id"]:
            resolved_uid = None
            sid = shot.get("session_id")
            if sid:
                sess = None
                if isinstance(sid, str) and ObjectId.is_valid(sid):
                    sess = sessions_collection.find_one({"_id": ObjectId(sid)})
                elif isinstance(sid, ObjectId):
                    sess = sessions_collection.find_one({"_id": sid})
                if not sess:
                    captured = shot.get("captured_at")
                    if captured:
                        sess = sessions_collection.find_one(
                            {"start_time": {"$lte": captured}},
                            sort=[("start_time", -1)]
                        )
                if sess:
                    sess_uid = sess.get("user_id")
                    if sess_uid:
                        if isinstance(sess_uid, ObjectId):
                            resolved_uid = str(sess_uid)
                        else:
                            user = users_collection.find_one({"user_id": sess_uid}) or \
                                   users_collection.find_one({"user_id": str(sess_uid)}) or \
                                   users_collection.find_one({"_id": ObjectId(sess_uid) if ObjectId.is_valid(str(sess_uid)) else sess_uid})
                            if user:
                                resolved_uid = str(user["_id"])
                            else:
                                resolved_uid = str(sess_uid)
            if resolved_uid:
                shot["user_id"] = resolved_uid
                screenshots_collection.update_one({"_id": shot["_id"]}, {"$set": {"user_id": resolved_uid}})

    # Build user name map for caching (normalize keys to string)
    user_names = {}
    for u in users_collection.find():
        user_names[str(u["_id"])] = u.get("name", "Unknown")

    # Timezone offset in minutes (default 330 for IST)
    tz_offset = request.args.get("tz_offset")
    try:
        tz_offset_mins = int(tz_offset) if tz_offset is not None else 330
    except ValueError:
        tz_offset_mins = 330

    # Filter and format shots
    filtered_shots = []
    for shot in raw_shots:
        uid = str(shot.get("user_id")) if shot.get("user_id") else None
        if not uid:
            continue
        if employee_id and uid != employee_id:
            continue
        if allowed_uids is not None and uid not in allowed_uids:
            continue
            
        fp = shot.get("file_path", "")
        if fp:
            fp = "screenshots/" + os.path.basename(fp)

        uploaded_to_cloud = shot.get("uploaded_to_cloud", False)
        cloudinary_url = shot.get("cloudinary_url")

        # Check if file exists on disk (bypass if uploaded to cloud)
        if not (uploaded_to_cloud and cloudinary_url):
            backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            actual_path = os.path.join(backend_dir, fp) if fp else ""
            if not actual_path or not os.path.exists(actual_path):
                continue

        app_name = shot.get("app_name") or shot.get("app")
        if not app_name or app_name == "Unknown":
            app_name = "No Application Metadata"

        window_title = shot.get("window_title") or ""
        if window_title == "Unknown":
            window_title = ""

        captured_at = shot.get("captured_at", "")
        local_date_str = None
        local_time_str = "00:00"
        local_hour_str = "00:00"
        if captured_at:
            try:
                dt = datetime.fromisoformat(captured_at)
                if dt.tzinfo is not None:
                    dt = dt.astimezone(timezone.utc)
                else:
                    dt = dt.replace(tzinfo=timezone.utc)
                local_dt = dt + timedelta(minutes=tz_offset_mins)
                local_date_str = local_dt.strftime("%Y-%m-%d")
                local_time_str = local_dt.strftime("%H:%M")
                local_hour_str = local_dt.strftime("%H:00")
            except Exception:
                pass

        # Filter by date if requested
        if date and local_date_str != date:
            continue

        filtered_shots.append({
            "id": str(shot["_id"]),
            "hour": local_hour_str,
            "time": local_time_str,
            "app": app_name,
            "window_title": window_title,
            "activity": shot.get("activity", 90),
            "file_path": fp,
            "captured_at": captured_at,
            "user_name": user_names.get(uid, "Unknown"),
            "session_id": str(shot.get("session_id", "Unknown")),
            "cloudinary_url": cloudinary_url,
            "uploaded_to_cloud": uploaded_to_cloud
        })

    # Group by hour
    groups = defaultdict(list)
    for s in filtered_shots:
        groups[s["hour"]].append(s)

    result = []
    for hr, shots in groups.items():
        # Sort shots within hour newest first
        shots.sort(key=lambda x: x["captured_at"], reverse=True)
        result.append({"hour": hr, "shots": shots})

    # Sort hours descending
    result.sort(key=lambda g: g["hour"], reverse=True)
    return jsonify(result)


# ─────────────────────────────────────────────────
# App Usage
# ─────────────────────────────────────────────────

@reports_bp.route("/app-usage", methods=["GET"])
def get_app_usage():
    employee_id = request.args.get("employee_id") or request.args.get("user_id")
    caller_id = request.headers.get("X-User-Id")
    
    caller_role = "intern"
    if caller_id:
        caller = users_collection.find_one({"_id": ObjectId(caller_id) if ObjectId.is_valid(caller_id) else caller_id})
        if caller:
            caller_role = caller.get("role", "intern").lower()

    if caller_role == "intern":
        vis_scope = "INTERN_SCOPE"
        target_uid = caller_id
    elif caller_role in ["team_lead", "team lead"]:
        if employee_id:
            # Check if this user is a team member or himself
            allowed = _resolve_allowed_uids(caller_id)
            if employee_id in allowed or employee_id == caller_id:
                vis_scope = "INTERN_SCOPE"
                target_uid = employee_id
            else:
                return jsonify([])
        else:
            vis_scope = "TEAM_SCOPE"
            target_uid = caller_id
    else: # admin
        if employee_id:
            vis_scope = "INTERN_SCOPE"
            target_uid = employee_id
        else:
            vis_scope = "ADMIN_SCOPE"
            target_uid = caller_id

    stats = aggregate_telemetry(target_uid, "ALL_TIME_SCOPE", visibility_scope=vis_scope, include_screenshots=False, compute_sites=False)
    
    # Format and sort
    apps_list = []
    for app in stats["apps"]:
        name = app["name"]
        dur = app["duration"]
        category = app["category"]
        mins = max(1, int(round(dur / 60))) if dur > 0 else 0
        apps_list.append({"name": name, "category": category, "minutes": mins})
        
    return jsonify(apps_list)


@reports_bp.route("/site-usage", methods=["GET"])
def get_site_usage():
    employee_id = request.args.get("employee_id") or request.args.get("user_id")
    caller_id = request.headers.get("X-User-Id")
    
    caller_role = "intern"
    if caller_id:
        caller = users_collection.find_one({"_id": ObjectId(caller_id) if ObjectId.is_valid(caller_id) else caller_id})
        if caller:
            caller_role = caller.get("role", "intern").lower()

    if caller_role == "intern":
        vis_scope = "INTERN_SCOPE"
        target_uid = caller_id
    elif caller_role in ["team_lead", "team lead"]:
        if employee_id:
            # Check if this user is a team member or himself
            allowed = _resolve_allowed_uids(caller_id)
            if employee_id in allowed or employee_id == caller_id:
                vis_scope = "INTERN_SCOPE"
                target_uid = employee_id
            else:
                return jsonify([])
        else:
            vis_scope = "TEAM_SCOPE"
            target_uid = caller_id
    else: # admin
        if employee_id:
            vis_scope = "INTERN_SCOPE"
            target_uid = employee_id
        else:
            vis_scope = "ADMIN_SCOPE"
            target_uid = caller_id

    stats = aggregate_telemetry(target_uid, "ALL_TIME_SCOPE", visibility_scope=vis_scope, include_screenshots=False, compute_apps=False)
    
    # Format and sort
    sites_list = []
    for site in stats["sites"]:
        domain = site["domain"]
        dur = site["duration"]
        category = site["category"]
        mins = max(1, int(round(dur / 60))) if dur > 0 else 0
        sites_list.append({"domain": domain, "category": category, "minutes": mins})
        
    return jsonify(sites_list)


# ─────────────────────────────────────────────────
# Productivity Trend
# ─────────────────────────────────────────────────

@reports_bp.route("/productivity-trend", methods=["GET"])
def get_productivity_trend():
    employee_id = request.args.get("employee_id") or request.args.get("user_id")
    caller_id = request.headers.get("X-User-Id")
    try:
        num_days = int(request.args.get("days", 7))
    except ValueError:
        num_days = 7

    today_local = datetime.utcnow() + timedelta(minutes=330)
    dates = [(today_local - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(num_days)]
    dates.reverse()

    caller_role = "intern"
    if caller_id:
        caller = users_collection.find_one({"_id": ObjectId(caller_id) if ObjectId.is_valid(caller_id) else caller_id})
        if caller:
            caller_role = caller.get("role", "intern").lower()

    allowed_uids = _resolve_allowed_uids(caller_id, employee_id)
    
    if allowed_uids is not None:
        target_uids = list(allowed_uids)
        if caller_role in ["team_lead", "team lead"] and not employee_id:
            if caller_id not in target_uids:
                target_uids.append(caller_id)
    else:
        all_users = list(users_collection.find({}, {"_id": 1}))
        target_uids = [str(u["_id"]) for u in all_users]

    from config.productivity_rules import calculate_productivity

    trend = []
    for date_str in dates:
        day_scores = []
        for uid in target_uids:
            res = calculate_productivity(uid, date_str)
            if res["tracked_minutes"] > 0:
                day_scores.append(res["productivity"])
                
        if day_scores:
            day_avg = int(round(sum(day_scores) / len(day_scores)))
        else:
            day_avg = 0
            
        try:
            day_name = datetime.strptime(date_str, "%Y-%m-%d").strftime("%a")
        except Exception:
            day_name = date_str
            
        trend.append({"day": day_name, "date": date_str, "productivity": day_avg})

    return jsonify(trend)


# ─────────────────────────────────────────────────
# Work Time Trend
# ─────────────────────────────────────────────────

@reports_bp.route("/work-time-trend", methods=["GET"])
def get_work_time_trend():
    employee_id = request.args.get("employee_id") or request.args.get("user_id")
    try:
        num_days = int(request.args.get("days", 7))
    except ValueError:
        num_days = 7

    today_local = datetime.utcnow() + timedelta(minutes=330)
    dates = [(today_local - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(num_days)]
    dates.reverse()

    from config.productivity_rules import calculate_productivity

    trend = []
    for date_str in dates:
        if employee_id:
            res = calculate_productivity(employee_id, date_str)
            work_hours = round(res["active_minutes"] / 60.0, 1)
        else:
            all_users = list(users_collection.find({}, {"_id": 1}))
            total_active = 0.0
            for u in all_users:
                res = calculate_productivity(str(u["_id"]), date_str)
                total_active += res["active_minutes"]
            work_hours = round(total_active / 60.0, 1)

        try:
            day_name = datetime.strptime(date_str, "%Y-%m-%d").strftime("%a")
        except Exception:
            day_name = date_str
        trend.append({"day": day_name, "date": date_str, "hours": work_hours, "work_hours": work_hours})

    return jsonify(trend)


# ─────────────────────────────────────────────────
# Public Stats (For Landing Page)
# ─────────────────────────────────────────────────

_public_stats_cache = {
    "data": None,
    "timestamp": 0
}

@reports_bp.route("/public-stats", methods=["GET"])
def get_public_stats():
    try:
        current_time = time.time()
        if _public_stats_cache["data"] and (current_time - _public_stats_cache["timestamp"] < 300):
            return jsonify(_public_stats_cache["data"])

        interns = list(users_collection.find({"role": {"$in": ["intern", "user"]}}))
        registered_interns = len(interns)
        
        prod_scores = []
        total_active_mins = 0.0
        for intern in interns:
            uid = str(intern["_id"])
            stats = aggregate_telemetry(uid, "ALL_TIME_SCOPE", include_screenshots=False)
            if stats["tracked_mins"] > 0:
                prod_scores.append(stats["productivity"])
            total_active_mins += stats["active_mins"]
            
        avg_productivity = int(round(sum(prod_scores) / len(prod_scores))) if prod_scores else 0
        hours_tracked = round(total_active_mins / 60.0, 1)
        
        active_users = monitoring_states_collection.count_documents({"current_state": "RUNNING"})
        projects = projects_collection.count_documents({})
        screenshots_captured = screenshots_collection.count_documents({})
        
        result = {
            "registered_interns": registered_interns,
            "active_users": active_users,
            "projects": projects,
            "average_productivity": avg_productivity,
            "hours_tracked": hours_tracked,
            "screenshots_captured": screenshots_captured,
            "today_active_monitoring": active_users
        }
        
        _public_stats_cache["data"] = result
        _public_stats_cache["timestamp"] = current_time
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────────
# Team Lead Analytics
# ─────────────────────────────────────────────────

@reports_bp.route("/team-lead-analytics/<lead_id>", methods=["GET"])
def get_team_lead_analytics(lead_id):
    """Dedicated endpoint for team lead analytics panel."""
    try:
        user = users_collection.find_one({"_id": ObjectId(lead_id) if ObjectId.is_valid(lead_id) else lead_id})
        if not user:
            return jsonify({"error": "User not found"}), 404
        uid = str(user["_id"])
        stats = _build_team_lead_stats(uid, user)
        return jsonify(stats)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 400


@reports_bp.route("/dashboard-data", methods=["GET"])
def get_dashboard_data():
    user_id = request.args.get("user_id")
    role = request.args.get("role", "intern")
    
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    from routes.monitoring import get_status, get_all_status
    from routes.users import get_users
    from routes.projects import get_assigned_projects
    from database.mongodb import tasks_collection, projects_collection
    from bson import ObjectId
    from utils.serializer import serialize_doc

    def _unwrap(res):
        if isinstance(res, tuple):
            res = res[0]
        if hasattr(res, "get_json"):
            try:
                val = res.get_json()
                if val is not None:
                    return val
            except Exception:
                pass
        if hasattr(res, "data"):
            import json
            try:
                return json.loads(res.data.decode('utf-8'))
            except Exception:
                pass
        return res

    if role in ("intern", "user"):
        t0 = time.perf_counter()
        # 1. Summary
        summary = _unwrap(get_intern_summary(user_id, dashboard=True)) or {}
        t1 = time.perf_counter()
        
        # 2. Monitoring Status
        monitoring_status = _unwrap(get_status(user_id)) or {}
        t2 = time.perf_counter()
        
        # 3. Recent Activity
        recent_activity = _unwrap(get_recent_activity()) or []
        t3 = time.perf_counter()
        
        # 4. Productivity Trend
        productivity_trend = _unwrap(get_productivity_trend()) or []
        t4 = time.perf_counter()

        # 5. Tasks & Projects
        user_tasks = [serialize_doc(t) for t in tasks_collection.find({"assigned_to": user_id})]
        user_projects = [serialize_doc(p) for p in projects_collection.find({"member_ids": {"$in": [user_id, ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id]}})]
        t5 = time.perf_counter()

        print(f"[DASHBOARD TIMING] Summary: {(t1-t0)*1000:.2f}ms | Status: {(t2-t1)*1000:.2f}ms | Activity: {(t3-t2)*1000:.2f}ms | Trend: {(t4-t3)*1000:.2f}ms | Tasks/Projects: {(t5-t4)*1000:.2f}ms")
        
        res_data = {
            "summary": summary,
            "monitoring": monitoring_status,
            "monitoring_status": monitoring_status,
            "tasks": user_tasks,
            "projects": user_projects,
            "activity": recent_activity,
            "recent_activity": recent_activity,
            "productivity": productivity_trend,
            "productivity_trend": productivity_trend,
            "app_usage": summary.get("today_apps", []),
            "site_usage": summary.get("today_sites", []),
            "task_counts": {
                "total": summary.get("task_count", 0),
                "completed": summary.get("completedTasksCount", 0)
            },
            "today_used": {
                "apps": summary.get("today_apps", []),
                "sites": summary.get("today_sites", [])
            }
        }
        return jsonify(res_data)
    else:
        # Team Lead dashboard
        t0 = time.perf_counter()
        # 1. Users
        users = _unwrap(get_users()) or []
        t1 = time.perf_counter()
        
        # 2. Recent Activity
        recent_activity = _unwrap(get_recent_activity()) or []
        t2 = time.perf_counter()
        
        # 3. Productivity Trend
        orig_args = request.args.copy()
        from werkzeug.datastructures import MultiDict
        request.args = MultiDict({k: v for k, v in orig_args.items() if k not in ("user_id", "employee_id")})
        team_trend = _unwrap(get_productivity_trend()) or []
        request.args = orig_args
        personal_trend = _unwrap(get_productivity_trend()) or []
        t3 = time.perf_counter()
        
        # 4. Assigned Projects
        assigned_projects = _unwrap(get_assigned_projects(user_id)) or []
        t4 = time.perf_counter()
        
        # 5. Lead's own summary
        summary = _unwrap(get_intern_summary(user_id, dashboard=True)) or {}
        t5 = time.perf_counter()
        
        # 6. Lead's own status
        monitoring_status = _unwrap(get_status(user_id)) or {}
        t6 = time.perf_counter()
        
        # 7. Team status
        all_monitoring_statuses = _unwrap(get_all_status()) or []
        t7 = time.perf_counter()

        # 8. Tasks & Projects
        project_ids = [(p if isinstance(p, str) else (p.get("id") or str(p.get("_id")))) for p in assigned_projects if p]
        lead_tasks = [serialize_doc(t) for t in tasks_collection.find({"project_id": {"$in": project_ids}})]
        t8 = time.perf_counter()

        print(f"[DASHBOARD TL TIMING] Users: {(t1-t0)*1000:.2f}ms | Activity: {(t2-t1)*1000:.2f}ms | Trend: {(t3-t2)*1000:.2f}ms | Projs: {(t4-t3)*1000:.2f}ms | Summary: {(t5-t4)*1000:.2f}ms | Status: {(t6-t5)*1000:.2f}ms | AllStatus: {(t7-t6)*1000:.2f}ms | Tasks: {(t8-t7)*1000:.2f}ms")
        
        # Do not override summary today used stats with team today stats for team lead dashboard views
        # (This preserves the Lead's personal metrics in summary and team metrics in summary["team_stats"])
        pass

        res_data = {
            "users": users,
            "recent_activity": recent_activity,
            "activity": recent_activity,
            "productivity_trend": team_trend,
            "productivity": team_trend,
            "personal_productivity_trend": personal_trend,
            "assigned_projects": assigned_projects,
            "projects": assigned_projects,
            "summary": summary,
            "monitoring_status": monitoring_status,
            "monitoring": monitoring_status,
            "all_monitoring_statuses": all_monitoring_statuses,
            "tasks": lead_tasks,
            "app_usage": summary.get("today_apps", []) if summary else [],
            "site_usage": summary.get("today_sites", []) if summary else []
        }
        return jsonify(res_data)

@reports_bp.route("/export-csv", methods=["GET"])
def export_csv():
    employee_id = request.args.get("employee_id") or request.args.get("user_id")
    scope = request.args.get("scope", "all_time")
    
    from config.productivity_rules import calculate_productivity
    
    if employee_id and employee_id != "all":
        res = calculate_productivity(employee_id, scope)
        filename = f"productivity_report_{employee_id}_{scope}.csv"
    else:
        # Org-wide CSV
        all_users = list(users_collection.find({}, {"_id": 1}))
        summaries = []
        for u in all_users:
            res = calculate_productivity(str(u["_id"]), scope)
            summaries.append(res)
            
        combined = {
            "tracked_minutes": sum(s["tracked_minutes"] for s in summaries),
            "active_minutes": sum(s["active_minutes"] for s in summaries),
            "idle_minutes": sum(s["idle_minutes"] for s in summaries),
            "locked_minutes": sum(s["locked_minutes"] for s in summaries),
            "productive_minutes": sum(s["productive_minutes"] for s in summaries),
            "neutral_minutes": sum(s["neutral_minutes"] for s in summaries),
            "unproductive_minutes": sum(s["unproductive_minutes"] for s in summaries),
            "efficiency_ratio": sum(s["efficiency_ratio"] for s in summaries) / len(summaries) if summaries else 0.0,
            "activity_ratio": sum(s["activity_ratio"] for s in summaries) / len(summaries) if summaries else 0.0,
            "productivity": int(round(sum(s["productivity"] for s in summaries) / len(summaries))) if summaries else 0,
            "productive_apps": [], "neutral_apps": [], "unproductive_apps": [],
            "productive_sites": [], "neutral_sites": [], "unproductive_sites": []
        }
        
        # Merge apps/sites durations
        app_durs = defaultdict(int)
        site_durs = defaultdict(int)
        for s in summaries:
            for app in s["productive_apps"] + s["neutral_apps"] + s["unproductive_apps"]:
                app_durs[app["name"]] += app["duration"]
            for site in s["productive_sites"] + s["neutral_sites"] + s["unproductive_sites"]:
                site_durs[site["domain"]] += site["duration"]
                
        from config.productivity_rules import classify_app_by_title_and_name, classify_website_new
        for name, dur in app_durs.items():
            cat = classify_app_by_title_and_name(name, "")
            app_obj = {"name": name, "duration": dur, "percentage": 0, "category": cat}
            if cat == "productive": combined["productive_apps"].append(app_obj)
            elif cat == "unproductive": combined["unproductive_apps"].append(app_obj)
            else: combined["neutral_apps"].append(app_obj)
            
        for domain, dur in site_durs.items():
            cat = classify_website_new(domain, "")
            site_obj = {"domain": domain, "duration": dur, "percentage": 0, "category": cat}
            if cat == "productive": combined["productive_sites"].append(site_obj)
            elif cat == "unproductive": combined["unproductive_sites"].append(site_obj)
            else: combined["neutral_sites"].append(site_obj)
            
        res = combined
        filename = f"org_productivity_report_{scope}.csv"

    import csv
    import io
    from flask import Response

    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow([
        "Metric", "Value"
    ])
    writer.writerow(["Tracked Time (Minutes)", round(res["tracked_minutes"], 1)])
    writer.writerow(["Active Time (Minutes)", round(res["active_minutes"], 1)])
    writer.writerow(["Idle Time (Minutes)", round(res["idle_minutes"], 1)])
    writer.writerow(["Locked Time (Minutes)", round(res["locked_minutes"], 1)])
    writer.writerow(["Productive Time (Minutes)", round(res["productive_minutes"], 1)])
    writer.writerow(["Neutral Time (Minutes)", round(res["neutral_minutes"], 1)])
    writer.writerow(["Unproductive Time (Minutes)", round(res["unproductive_minutes"], 1)])
    writer.writerow(["Efficiency Ratio (%)", round(res["efficiency_ratio"] * 100.0, 1)])
    writer.writerow(["Activity Ratio (%)", round(res["activity_ratio"] * 100.0, 1)])
    writer.writerow(["Productivity %", res["productivity"]])
    
    # Add a blank line and then apps/sites lists
    writer.writerow([])
    writer.writerow(["Application / Website", "Duration (Seconds)", "Percentage", "Category"])
    for app in res["productive_apps"] + res["neutral_apps"] + res["unproductive_apps"]:
        writer.writerow([app["name"], app["duration"], app["percentage"], app["category"]])
    for site in res["productive_sites"] + res["neutral_sites"] + res["unproductive_sites"]:
        writer.writerow([site["domain"], site["duration"], site["percentage"], site["category"]])

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-disposition": f"attachment; filename={filename}"}
    )