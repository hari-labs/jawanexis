from flask import Blueprint, jsonify, request
from collections import defaultdict
from bson import ObjectId
from datetime import datetime, timedelta, timezone
import os

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
    DISTRACTING_SITES
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
        allowed = {caller_uid}
        for p in projects:
            for mid in p.get("member_ids", []):
                allowed.add(str(mid))
        allowed_list = list(allowed)
        if employee_id:
            if employee_id in allowed_list:
                return [employee_id]
            else:
                return []
        return allowed_list
    else:
        if employee_id:
            return [employee_id]
        return None

def _resolve_user_ids(mongo_user_id: str):
    """
    Given a MongoDB user _id string, return the full set of IDs that
    might appear as 'user_id' in sessions/screenshots/applications.
    Covers: ObjectId, str(ObjectId), legacy int user_id.
    """
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
    return list(ids)

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

def _resolve_session_active_idle(s):
    """
    Return a tuple (active_minutes, idle_minutes) for a session.
    Calculates precise values based on actual application usage telemetry and session duration.
    """
    start_str = s.get("start_time")
    if not start_str:
        return 0, 0
        
    try:
        if start_str.endswith("Z"):
            start_str = start_str[:-1] + "+00:00"
        start_dt = datetime.fromisoformat(start_str)
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=timezone.utc)
    except Exception:
        return 0, 0

    end_str = s.get("end_time")
    if end_str:
        try:
            if end_str.endswith("Z"):
                end_str = end_str[:-1] + "+00:00"
            end_dt = datetime.fromisoformat(end_str)
            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=timezone.utc)
            total_seconds = max(0, int((end_dt - start_dt).total_seconds()))
        except Exception:
            total_seconds = 0
    else:
        uid = str(s.get("user_id"))
        state_doc = monitoring_states_collection.find_one({"user_id": uid})
        if state_doc and (str(state_doc.get("current_session_id")) == str(s["_id"]) or state_doc.get("current_state") == "RUNNING"):
            from routes.monitoring import calculate_elapsed_seconds
            total_seconds = calculate_elapsed_seconds(state_doc)
        else:
            total_seconds = 0

    app_usages = list(applications_collection.find({"session_id": {"$in": [s["_id"], str(s["_id"])]}}))
    total_app_seconds = sum(app.get("duration_seconds") or app.get("duration") or 0 for app in app_usages)

    active_seconds = min(total_seconds, total_app_seconds)
    idle_seconds = max(0, total_seconds - active_seconds)

    if active_seconds == 0 and idle_seconds == 0 and total_seconds > 0:
        active_seconds = total_seconds

    active_mins = round(active_seconds / 60, 2)
    idle_mins = round(idle_seconds / 60, 2)
    
    return active_mins, idle_mins


def _resolve_session_for_telemetry(doc, time_field="start_time"):
    """
    Resolve the session for an application/website/screenshot document.
    Tries ObjectId lookup first, then integer session_id → session map,
    then time-range overlap as fallback.
    """
    raw_sid = doc.get("session_id")
    if raw_sid is None:
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
    # Sessions created by the sync_service may store an int session_id
    # that maps to a MongoDB _id via user_id on the session doc
    # (This is the legacy path — sync_service now stores ObjectId strings)
    # We try time-range fallback:
    event_time = doc.get(time_field)
    if not event_time:
        return None

    # Find sessions whose time range overlaps with event_time
    candidates = list(
        sessions_collection.find({"start_time": {"$lte": event_time}}).sort("start_time", -1).limit(20)
    )
    for sess in candidates:
        end_time = sess.get("end_time")
        if not end_time or event_time <= end_time:
            return sess
    return candidates[0] if candidates else None

def _build_user_summary(user):
    """Build full stats summary for a user."""
    uid = str(user["_id"])
    sessions = _get_user_sessions(uid)

    total_active_mins = 0
    total_idle_mins = 0
    for s in sessions:
        act, idl = _resolve_session_active_idle(s)
        total_active_mins += act
        total_idle_mins += idl
    total_active_mins = round(total_active_mins, 2)
    total_idle_mins = round(total_idle_mins, 2)
    total_time = round(total_active_mins + total_idle_mins, 2)
    productivity = round((total_active_mins / total_time) * 100) if total_time > 0 else 0
    work_hours = round(total_active_mins / 60, 2)
    break_hours = round(total_idle_mins / 60, 2)

    latest_session = sessions[0] if sessions else None

    current_app = "-"
    current_site = "-"
    if latest_session:
        sess_id = latest_session["_id"]
        # Try session_id (ObjectId or string) first, then user_id direct field
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
            current_app = app_doc.get("app_name") or "-"

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
            current_site = site_doc.get("website") or "-"

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
    state_doc = monitoring_states_collection.find_one({"user_id": uid})
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
        "workHours": work_hours,
        "breakHours": break_hours,
        "currentApp": current_app,
        "currentSite": current_site,
        "lastActive": latest_session.get("start_time", "-") if latest_session else "-",
        "productivity": productivity,
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
    employee_id = request.args.get("employee_id")
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
def get_intern_summary(user_id):
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
        if not user:
            return jsonify({"error": "User not found"}), 404

        uid = str(user["_id"])
        all_sessions = _get_user_sessions(uid)
        session_id_filter = request.args.get("session_id")

        stats_sessions = all_sessions
        if session_id_filter and session_id_filter != "all":
            stats_sessions = [s for s in all_sessions if str(s["_id"]) == session_id_filter]

        # Session ID set for telemetry matching
        stats_session_oids = {s["_id"] for s in stats_sessions}
        stats_session_strs = {str(s["_id"]) for s in stats_sessions}

        def _session_matches(raw_sid):
            if isinstance(raw_sid, ObjectId):
                return raw_sid in stats_session_oids
            if isinstance(raw_sid, str) and len(raw_sid) == 24:
                try:
                    return ObjectId(raw_sid) in stats_session_oids
                except Exception:
                    pass
            return raw_sid in stats_session_strs

        # ── Basic stats ────────────────────────────
        total_active_mins = 0
        total_idle_mins = 0
        for s in stats_sessions:
            act, idl = _resolve_session_active_idle(s)
            total_active_mins += act
            total_idle_mins += idl
        total_active_mins = round(total_active_mins, 2)
        total_idle_mins = round(total_idle_mins, 2)
        total_work_mins = round(total_active_mins + total_idle_mins, 2)
        productivity = round((total_active_mins / total_work_mins) * 100) if total_work_mins > 0 else 0

        # Calculate today's metrics
        today_local_dt = datetime.utcnow() + timedelta(minutes=330)
        today_prefix = today_local_dt.strftime("%Y-%m-%d")
        
        today_sessions = []
        for s in all_sessions:
            local_dt = _utc_to_local_ist(s.get("start_time"))
            if local_dt and local_dt.strftime("%Y-%m-%d") == today_prefix:
                today_sessions.append(s)

        today_active_mins = 0
        today_idle_mins = 0
        for s in today_sessions:
            act, idl = _resolve_session_active_idle(s)
            today_active_mins += act
            today_idle_mins += idl
        today_active_mins = round(today_active_mins, 2)
        today_idle_mins = round(today_idle_mins, 2)
        today_work_mins_val = round(today_active_mins + today_idle_mins, 2)
        today_productivity = round((today_active_mins / today_work_mins_val) * 100) if today_work_mins_val > 0 else 0
        today_work_hours = round(today_active_mins / 60, 2)
        today_break_hours = round(today_idle_mins / 60, 2)

        # Today's apps and sites
        today_session_oids = {s["_id"] for s in today_sessions}
        today_session_strs = {str(s["_id"]) for s in today_sessions}

        def _is_today_session(raw_sid):
            if isinstance(raw_sid, ObjectId):
                return raw_sid in today_session_oids
            if isinstance(raw_sid, str) and len(raw_sid) == 24:
                try:
                    return ObjectId(raw_sid) in today_session_oids
                except Exception:
                    pass
            return raw_sid in today_session_strs

        today_app_durations = defaultdict(int)
        for app in applications_collection.find():
            raw_sid = app.get("session_id")
            matched = _is_today_session(raw_sid)
            if not matched:
                sess = _resolve_session_for_telemetry(app)
                if sess and sess["_id"] in today_session_oids:
                    matched = True
            if matched:
                name = app.get("application_name") or app.get("app_name") or "No Application Metadata"
                if name == "Unknown":
                    name = "No Application Metadata"
                today_app_durations[name] += app.get("duration_seconds") or app.get("duration") or 0

        today_apps_list = []
        for name, dur in today_app_durations.items():
            today_apps_list.append({"name": name, "duration": dur})
        today_apps_list.sort(key=lambda x: x["duration"], reverse=True)

        today_site_durations = defaultdict(int)
        for site in websites_collection.find():
            raw_sid = site.get("session_id")
            matched = _is_today_session(raw_sid)
            if not matched:
                sess = _resolve_session_for_telemetry(site)
                if sess and sess["_id"] in today_session_oids:
                    matched = True
            if matched:
                domain = site.get("domain") or site.get("website") or "Unknown"
                today_site_durations[domain] += site.get("duration_seconds") or site.get("duration") or 0

        today_sites_list = []
        for domain, dur in today_site_durations.items():
            today_sites_list.append({"domain": domain, "duration": dur})
        today_sites_list.sort(key=lambda x: x["duration"], reverse=True)

        # ── Applications ───────────────────────────
        app_durations = defaultdict(int)
        for app in applications_collection.find():
            raw_sid = app.get("session_id")
            matched = _session_matches(raw_sid)
            if not matched:
                # Fallback: resolve by time overlap
                sess = _resolve_session_for_telemetry(app)
                if sess and sess["_id"] in stats_session_oids:
                    matched = True
            if matched:
                name = app.get("application_name") or app.get("app_name") or "No Application Metadata"
                if name == "Unknown":
                    name = "No Application Metadata"
                app_durations[name] += app.get("duration_seconds") or app.get("duration") or 0

        total_app_seconds = sum(app_durations.values())
        apps_list = []
        for name, dur in app_durations.items():
            pct = round((dur / total_app_seconds) * 100) if total_app_seconds > 0 else 0
            nl = name.lower()
            is_productive = any(kw.lower() in nl or nl in kw.lower() for kw in PRODUCTIVE_APPS)
            is_distracting = any(kw.lower() in nl or nl in kw.lower() for kw in DISTRACTING_APPS)
            category = "productive" if is_productive else ("distracting" if is_distracting else "neutral")
            apps_list.append({"name": name, "duration": dur, "percentage": pct, "category": category})
        apps_list.sort(key=lambda x: x["duration"], reverse=True)

        # ── Websites ───────────────────────────────
        site_durations = defaultdict(int)
        for site in websites_collection.find():
            raw_sid = site.get("session_id")
            matched = _session_matches(raw_sid)
            if not matched:
                sess = _resolve_session_for_telemetry(site)
                if sess and sess["_id"] in stats_session_oids:
                    matched = True
            if matched:
                domain = site.get("domain") or site.get("website") or "Unknown"
                site_durations[domain] += site.get("duration_seconds") or site.get("duration") or 0

        total_site_seconds = sum(site_durations.values())
        sites_list = []
        for domain, dur in site_durations.items():
            pct = round((dur / total_site_seconds) * 100) if total_site_seconds > 0 else 0
            dl = domain.lower()
            is_productive = any(kw.lower() in dl or dl in kw.lower() for kw in PRODUCTIVE_SITES)
            is_distracting = any(kw.lower() in dl or dl in kw.lower() for kw in DISTRACTING_SITES)
            category = "productive" if is_productive else ("distracting" if is_distracting else "neutral")
            sites_list.append({"domain": domain, "duration": dur, "percentage": pct, "category": category})
        sites_list.sort(key=lambda x: x["duration"], reverse=True)

        # ── Screenshots ────────────────────────────
        screenshots_list = []
        screenshot_count = 0

        # Primary: screenshots with user_id field (directly owned)
        direct_shots = list(screenshots_collection.find({"user_id": uid}).sort("captured_at", -1))
        for shot in direct_shots:
            fmt_shot = _format_screenshot(shot)
            if fmt_shot:
                screenshot_count += 1
                screenshots_list.append(fmt_shot)

        if not screenshots_list and not direct_shots:
            # Fallback: resolve via session_id
            for shot in screenshots_collection.find().sort("captured_at", -1):
                raw_sid = shot.get("session_id")
                matched = _session_matches(raw_sid)
                if not matched:
                    sess = _resolve_session_for_telemetry(shot, time_field="captured_at")
                    if sess and sess["_id"] in stats_session_oids:
                        matched = True
                if matched:
                    fmt_shot = _format_screenshot(shot)
                    if fmt_shot:
                        screenshot_count += 1
                        screenshots_list.append(fmt_shot)

        screenshots_list.sort(key=lambda x: x.get("captured_at", ""), reverse=True)

        # ── Projects & Tasks ───────────────────────
        user_oids = [uid]
        if ObjectId.is_valid(uid):
            user_oids.append(ObjectId(uid))

        role = user.get("role", "intern")
        if role in ["team_lead", "team lead"]:
            projects = list(projects_collection.find({"lead_id": {"$in": user_oids}}))
        else:
            projects = list(projects_collection.find({"member_ids": {"$in": user_oids}}))
        
        user_tasks = list(tasks_collection.find({"assigned_to": {"$in": user_oids}}))
        completed_tasks_count = sum(1 for t in user_tasks if t.get("status") in ("Completed", "Approved", "completed", "approved"))

        # ── Session history ────────────────────────
        serialized_sessions = []
        for s in all_sessions[:20]:
            serialized_sessions.append({
                "id": str(s["_id"]),
                "start_time": s.get("start_time", ""),
                "end_time": s.get("end_time", ""),
                "active_minutes": s.get("active_minutes", 0),
                "idle_minutes": s.get("idle_minutes", 0),
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
        state_doc = monitoring_states_collection.find_one({"user_id": uid})
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
        if role in ["team_lead", "team lead"]:
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
            # Rich analytics
            "total_active_mins": total_active_mins,
            "total_idle_mins": total_idle_mins,
            "total_work_mins": total_work_mins,
            "today_active_mins": today_active_mins,
            "today_idle_mins": today_idle_mins,
            "today_work_mins": today_work_mins_val,
            "apps": apps_list,
            "sites": sites_list,
            "today_apps": today_apps_list,
            "today_sites": today_sites_list,
            "screenshot_count": screenshot_count,
            "screenshots": screenshots_list[:24],
            "app_count": len(apps_list),
            "site_count": len(sites_list),
            "sessions": serialized_sessions,
            "project_count": len(projects),
            "task_count": len(user_tasks),
            "projects": [{"id": str(p["_id"]), "name": p.get("name", "")} for p in projects],
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


def _build_team_lead_stats(lead_id: str, lead_user: dict):
    """Build analytics for a team lead view."""
    lead_oids = [lead_id]
    if ObjectId.is_valid(lead_id):
        lead_oids.append(ObjectId(lead_id))
    led_projects = list(projects_collection.find({"lead_id": {"$in": lead_oids}}))

    # Gather all member IDs
    all_member_ids = set()
    for p in led_projects:
        for mid in p.get("member_ids", []):
            all_member_ids.add(str(mid))

    members = list(users_collection.find({"_id": {"$in": [
        ObjectId(m) if ObjectId.is_valid(m) else m for m in all_member_ids
    ]}}))

    # Monitoring statuses
    member_states = []
    for m in members:
        uid = str(m["_id"])
        state_doc = monitoring_states_collection.find_one({"user_id": uid})
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

    # Productivity & active/idle times
    total_prod = 0
    total_active_mins = 0
    total_idle_mins = 0
    team_apps = set()
    team_sites = set()
    member_count = len(members)

    for m in members:
        uid = str(m["_id"])
        sessions = _get_user_sessions(uid)
        
        m_active = 0
        m_idle = 0
        for s in sessions:
            act, idl = _resolve_session_active_idle(s)
            m_active += act
            m_idle += idl
        total_active_mins += m_active
        total_idle_mins += m_idle
        
        m_total = m_active + m_idle
        total_prod += round((m_active / m_total) * 100) if m_total > 0 else 0

        # Unique apps and sites used by this member
        session_oids = {s["_id"] for s in sessions}
        session_strs = {str(s["_id"]) for s in sessions}
        
        user_ids = _resolve_user_ids(uid)
        for app in applications_collection.find({"$or": [{"session_id": {"$in": list(session_oids) + list(session_strs)}}, {"user_id": {"$in": user_ids}}]}):
            name = app.get("app_name") or app.get("application_name")
            if name and name != "Unknown":
                team_apps.add(name)

        for site in websites_collection.find({"$or": [{"session_id": {"$in": list(session_oids) + list(session_strs)}}, {"user_id": {"$in": user_ids}}]}):
            domain = site.get("domain") or site.get("website")
            if domain and domain != "Unknown":
                team_sites.add(domain)

    team_productivity = round(total_prod / member_count) if member_count > 0 else 0

    # Screenshot count for team
    shot_count = 0
    for m in members:
        uid = str(m["_id"])
        shot_count += screenshots_collection.count_documents({"user_id": uid})

    return {
        "led_project_count": len(led_projects),
        "managed_member_count": len(members),
        "active_members": active_members,
        "team_productivity": team_productivity,
        "team_active_mins": round(total_active_mins, 2),
        "team_idle_mins": round(total_idle_mins, 2),
        "team_apps_count": len(team_apps),
        "team_sites_count": len(team_sites),
        "team_task_count": len(team_tasks),
        "pending_tasks": pending_tasks,
        "in_progress_tasks": in_progress_tasks,
        "done_tasks": done_tasks,
        "team_screenshot_count": shot_count,
        "member_monitoring": member_states
    }


# ─────────────────────────────────────────────────
# Screenshot Report (grouped by hour)
# ─────────────────────────────────────────────────

@reports_bp.route("/screenshots", methods=["GET"])
def get_screenshot_report():
    employee_id = request.args.get("employee_id")
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
    employee_id = request.args.get("employee_id")
    caller_id = request.headers.get("X-User-Id")
    
    allowed_uids = _resolve_allowed_uids(caller_id, employee_id)
    if allowed_uids is not None:
        session_oids = set()
        for uid in allowed_uids:
            session_oids.update(_get_session_ids_for_user(uid))
    else:
        session_oids = None

    usage = {}
    for app in applications_collection.find():
        if session_oids is not None:
            raw_sid = app.get("session_id")
            matched = False
            if isinstance(raw_sid, ObjectId):
                matched = raw_sid in session_oids
            elif isinstance(raw_sid, str) and len(raw_sid) == 24:
                try:
                    matched = ObjectId(raw_sid) in session_oids
                except Exception:
                    pass
            if not matched:
                sess = _resolve_session_for_telemetry(app)
                if sess and sess["_id"] in session_oids:
                    matched = True
            if not matched:
                continue

        name = app.get("app_name") or app.get("application_name") or "No Application Metadata"
        if name == "Unknown":
            name = "No Application Metadata"
        seconds = app.get("duration_seconds") or app.get("duration") or 0

        nl = name.lower()
        is_productive = any(kw.lower() in nl or nl in kw.lower() for kw in PRODUCTIVE_APPS)
        is_distracting = any(kw.lower() in nl or nl in kw.lower() for kw in DISTRACTING_APPS)
        category = "productive" if is_productive else ("distracting" if is_distracting else "neutral")

        if name not in usage:
            usage[name] = {"name": name, "category": category, "seconds": 0}
        usage[name]["seconds"] += seconds

    for name in usage:
        usage[name]["minutes"] = max(1, int(round(usage[name]["seconds"] / 60))) if usage[name]["seconds"] > 0 else 0
        del usage[name]["seconds"]

    return jsonify(list(usage.values()))


# ─────────────────────────────────────────────────
# Site Usage
# ─────────────────────────────────────────────────

@reports_bp.route("/site-usage", methods=["GET"])
def get_site_usage():
    employee_id = request.args.get("employee_id")
    caller_id = request.headers.get("X-User-Id")
    
    allowed_uids = _resolve_allowed_uids(caller_id, employee_id)
    if allowed_uids is not None:
        session_oids = set()
        for uid in allowed_uids:
            session_oids.update(_get_session_ids_for_user(uid))
    else:
        session_oids = None

    usage = {}
    for site in websites_collection.find():
        if session_oids is not None:
            raw_sid = site.get("session_id")
            matched = False
            if isinstance(raw_sid, ObjectId):
                matched = raw_sid in session_oids
            elif isinstance(raw_sid, str) and len(raw_sid) == 24:
                try:
                    matched = ObjectId(raw_sid) in session_oids
                except Exception:
                    pass
            if not matched:
                sess = _resolve_session_for_telemetry(site)
                if sess and sess["_id"] in session_oids:
                    matched = True
            if not matched:
                continue

        domain = site.get("website") or site.get("domain") or "Unknown"
        seconds = site.get("duration_seconds") or site.get("duration") or 0

        dl = domain.lower()
        is_productive = any(kw.lower() in dl or dl in kw.lower() for kw in PRODUCTIVE_SITES)
        is_distracting = any(kw.lower() in dl or dl in kw.lower() for kw in DISTRACTING_SITES)
        category = "productive" if is_productive else ("distracting" if is_distracting else "neutral")

        if domain not in usage:
            usage[domain] = {"domain": domain, "category": category, "seconds": 0}
        usage[domain]["seconds"] += seconds

    for domain in usage:
        usage[domain]["minutes"] = max(1, int(round(usage[domain]["seconds"] / 60))) if usage[domain]["seconds"] > 0 else 0
        del usage[domain]["seconds"]

    return jsonify(list(usage.values()))


# ─────────────────────────────────────────────────
# Productivity Trend
# ─────────────────────────────────────────────────

@reports_bp.route("/productivity-trend", methods=["GET"])
def get_productivity_trend():
    employee_id = request.args.get("employee_id")
    caller_id = request.headers.get("X-User-Id")
    try:
        num_days = int(request.args.get("days", 7))
    except ValueError:
        num_days = 7

    today = datetime.now()
    dates = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(num_days)]
    dates.reverse()

    allowed_uids = _resolve_allowed_uids(caller_id, employee_id)
    
    session_query = {}
    if allowed_uids is not None:
        all_resolved_ids = []
        for uid in allowed_uids:
            all_resolved_ids.extend(_resolve_user_ids(uid))
        session_query["user_id"] = {"$in": all_resolved_ids}

    # Filter by date range directly in MongoDB to avoid full table scans
    oldest_date = (today - timedelta(days=num_days + 2)).strftime("%Y-%m-%d")
    session_query["start_time"] = {"$gte": oldest_date}

    sessions_by_date = defaultdict(list)
    for s in sessions_collection.find(session_query):
        start_time = s.get("start_time", "")
        local_dt = _utc_to_local_ist(start_time)
        if local_dt:
            local_date = local_dt.strftime("%Y-%m-%d")
            sessions_by_date[local_date].append(s)
        elif start_time and len(start_time) >= 10:
            sessions_by_date[start_time[:10]].append(s)

    trend = []
    for date_str in dates:
        day_sessions = sessions_by_date.get(date_str, [])
        total_active = 0
        total_idle = 0
        for s in day_sessions:
            act, idl = _resolve_session_active_idle(s)
            total_active += act
            total_idle += idl
        total_time = total_active + total_idle
        prod_score = round((total_active / total_time) * 100) if total_time > 0 else 0
        try:
            day_name = datetime.strptime(date_str, "%Y-%m-%d").strftime("%a")
        except Exception:
            day_name = date_str
        trend.append({"day": day_name, "date": date_str, "productivity": prod_score})

    return jsonify(trend)


# ─────────────────────────────────────────────────
# Work Time Trend
# ─────────────────────────────────────────────────

@reports_bp.route("/work-time-trend", methods=["GET"])
def get_work_time_trend():
    employee_id = request.args.get("employee_id")
    try:
        num_days = int(request.args.get("days", 7))
    except ValueError:
        num_days = 7

    today = datetime.now()
    dates = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(num_days)]
    dates.reverse()

    session_query = {}
    if employee_id:
        user = users_collection.find_one({"_id": ObjectId(employee_id) if ObjectId.is_valid(employee_id) else employee_id})
        if user:
            ids = _resolve_user_ids(str(user["_id"]))
            session_query["user_id"] = {"$in": ids}

    # Filter by date range directly in MongoDB to avoid full table scans
    oldest_date = (today - timedelta(days=num_days + 2)).strftime("%Y-%m-%d")
    session_query["start_time"] = {"$gte": oldest_date}

    sessions_by_date = defaultdict(list)
    for s in sessions_collection.find(session_query):
        start_time = s.get("start_time", "")
        local_dt = _utc_to_local_ist(start_time)
        if local_dt:
            local_date = local_dt.strftime("%Y-%m-%d")
            sessions_by_date[local_date].append(s)
        elif start_time and len(start_time) >= 10:
            sessions_by_date[start_time[:10]].append(s)

    trend = []
    for date_str in dates:
        day_sessions = sessions_by_date.get(date_str, [])
        total_active_mins = 0
        for s in day_sessions:
            act, idl = _resolve_session_active_idle(s)
            total_active_mins += act
        work_hours = round(total_active_mins / 60, 1)
        try:
            day_name = datetime.strptime(date_str, "%Y-%m-%d").strftime("%a")
        except Exception:
            day_name = date_str
        trend.append({"day": day_name, "date": date_str, "hours": work_hours, "work_hours": work_hours})

    return jsonify(trend)


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

    if role in ("intern", "user"):
        # 1. Summary
        summary = get_intern_summary(user_id).get_json()
        
        # 2. Monitoring Status
        monitoring_status = get_status(user_id).get_json()
        
        # 3. Recent Activity
        recent_activity = get_recent_activity().get_json()
        
        # 4. Productivity Trend
        productivity_trend = get_productivity_trend().get_json()
        
        return jsonify({
            "summary": summary,
            "monitoring_status": monitoring_status,
            "recent_activity": recent_activity,
            "task_counts": {
                "total": summary.get("task_count", 0),
                "completed": summary.get("completedTasksCount", 0)
            },
            "today_used": {
                "apps": summary.get("today_apps", []),
                "sites": summary.get("today_sites", [])
            },
            "productivity_trend": productivity_trend
        })
    else:
        # Team Lead dashboard
        # 1. Users
        users = get_users().get_json()
        
        # 2. Recent Activity
        recent_activity = get_recent_activity().get_json()
        
        # 3. Productivity Trend
        productivity_trend = get_productivity_trend().get_json()
        
        # 4. Assigned Projects
        assigned_projects = get_assigned_projects(user_id).get_json()
        
        # 5. Lead's own summary
        summary = get_intern_summary(user_id).get_json()
        
        # 6. Lead's own status
        monitoring_status = get_status(user_id).get_json()
        
        # 7. Team status
        all_monitoring_statuses = get_all_status().get_json()
        
        return jsonify({
            "users": users,
            "recent_activity": recent_activity,
            "productivity_trend": productivity_trend,
            "assigned_projects": assigned_projects,
            "summary": summary,
            "monitoring_status": monitoring_status,
            "all_monitoring_statuses": all_monitoring_statuses
        })