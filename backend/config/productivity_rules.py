# backend/config/productivity_rules.py

from datetime import datetime, timezone, timedelta
from bson import ObjectId
from collections import defaultdict

PRODUCTIVE_APPS = [
    "vs code",
    "cursor",
    "visual studio",
    "pycharm",
    "intellij",
    "android studio",
    "git",
    "github desktop",
    "terminal",
    "powershell",
    "cmd",
    "docker",
    "postman",
    "excel",
    "word",
    "powerpoint",
    "notion",
    "figma",
    "slack",
    "teams",
    "jira",
    "confluence"
]

NEUTRAL_APPS = [
    "explorer",
    "settings",
    "calculator",
    "paint",
    "snipping tool",
    "chrome",
    "edge",
    "firefox",
    "msedge"
]

UNPRODUCTIVE_APPS = [
    "spotify",
    "netflix",
    "prime",
    "instagram",
    "facebook",
    "tiktok",
    "games",
    "discord",
    "entertainment apps"
]

PRODUCTIVE_SITES = [
    "github.com",
    "stackoverflow.com",
    "developer.mozilla.org",
    "chatgpt.com",
    "docs.python.org",
    "leetcode.com"
]

NEUTRAL_SITES = [
    "gmail.com",
    "google.com"
]

UNPRODUCTIVE_SITES = [
    "spotify.com",
    "netflix.com",
    "instagram.com",
    "facebook.com",
    "tiktok.com",
    "discord.com"
]

DISTRACTING_APPS = UNPRODUCTIVE_APPS
DISTRACTING_SITES = UNPRODUCTIVE_SITES

BROWSERS = ["chrome", "msedge", "edge", "firefox", "browser", "safari", "opera"]

def is_browser(app_name):
    if not app_name:
        return False
    app_lower = app_name.lower()
    return any(b in app_lower for b in BROWSERS)

def classify_youtube(title):
    if not title:
        return "neutral"
    title_lower = title.lower()
    educational_keywords = [
        "tutorial", "course", "coding", "python", "react", "lecture", "education"
    ]
    entertainment_keywords = [
        "music", "lyrics", "movie", "song", "funny", "gaming", "trailer", "vlog", "comedy"
    ]
    if any(k in title_lower for k in entertainment_keywords):
        return "unproductive"
    if any(k in title_lower for k in educational_keywords):
        return "productive"
    return "neutral"

def classify_app_by_title_and_name(app_name, window_title=""):
    app_lower = (app_name or "").lower()
    wt_lower = (window_title or "").lower()
    
    if "lockapp" in app_lower or "lockapp" in wt_lower:
        return "lock"
        
    # Browser Resolution Fallback
    if is_browser(app_name):
        if wt_lower:
            for site in PRODUCTIVE_SITES:
                if site in wt_lower or site.split('.')[0] in wt_lower:
                    return "productive"
            for site in UNPRODUCTIVE_SITES:
                if site in wt_lower or site.split('.')[0] in wt_lower:
                    return "unproductive"
            for app in PRODUCTIVE_APPS:
                if app in wt_lower:
                    return "productive"
            for app in UNPRODUCTIVE_APPS:
                if app in wt_lower:
                    return "unproductive"
            if "youtube" in wt_lower:
                return classify_youtube(window_title)
        return "neutral"

    # Check explicit apps list first for non-browsers
    for app in PRODUCTIVE_APPS:
        if app in app_lower:
            return "productive"
    for app in UNPRODUCTIVE_APPS:
        if app in app_lower:
            return "unproductive"
    for app in NEUTRAL_APPS:
        if app in app_lower:
            return "neutral"
            
    # Check window title fallback keywords
    for site in PRODUCTIVE_SITES:
        if site in wt_lower or site.split('.')[0] in wt_lower:
            return "productive"
    for site in UNPRODUCTIVE_SITES:
        if site in wt_lower or site.split('.')[0] in wt_lower:
            return "unproductive"
    for app in PRODUCTIVE_APPS:
        if app in wt_lower:
            return "productive"
    for app in UNPRODUCTIVE_APPS:
        if app in wt_lower:
            return "unproductive"
            
    return "neutral"

def classify_website_new(domain, title=""):
    if not domain:
        return "neutral"
    
    dom_lower = domain.lower()
    
    if "youtube.com" in dom_lower or "youtube" in dom_lower:
        return classify_youtube(title)
        
    for site in PRODUCTIVE_SITES:
        if site in dom_lower:
            return "productive"
    for site in UNPRODUCTIVE_SITES:
        if site in dom_lower:
            return "unproductive"
    for site in NEUTRAL_SITES:
        if site in dom_lower:
            return "neutral"
            
    # Unresolved website -> fall back to window title
    if title:
        cat = classify_app_by_title_and_name("", title)
        if cat in ("productive", "unproductive", "neutral"):
            return cat
            
    return "neutral"

# Deprecated/compatibility mappings for old references
def classify_app(app_name, window_title=""):
    return classify_app_by_title_and_name(app_name, window_title)

def classify_website(domain, title=""):
    return classify_website_new(domain, title)

def calculate_productivity_score(productive_mins, neutral_mins, unproductive_mins, idle_mins, locked_mins):
    # Compatibility wrapper
    weighted_prod_mins = (productive_mins * 1.0) + (neutral_mins * 0.5)
    active_mins = productive_mins + neutral_mins + unproductive_mins
    tracked_mins = active_mins + idle_mins + locked_mins
    
    if tracked_mins <= 0:
        return 0
        
    efficiency = weighted_prod_mins / tracked_mins
    activity_ratio = active_mins / tracked_mins
    
    score = (0.70 * efficiency + 0.30 * activity_ratio) * 100.0
    return int(round(max(0.0, min(100.0, score))))

# ─────────────────────────────────────────────────
# Central Centralized Productivity Engine
# ─────────────────────────────────────────────────

_RESOLVED_USER_IDS_CACHE = {}

def _resolve_user_ids(mongo_user_id: str):
    from database.mongodb import users_collection
    mongo_user_id = str(mongo_user_id)
    if mongo_user_id in _RESOLVED_USER_IDS_CACHE:
        return _RESOLVED_USER_IDS_CACHE[mongo_user_id]

    ids = set()
    ids.add(mongo_user_id)
    try:
        ids.add(ObjectId(mongo_user_id))
    except Exception:
        pass
    user = users_collection.find_one({"_id": ObjectId(mongo_user_id) if ObjectId.is_valid(mongo_user_id) else mongo_user_id})
    if user:
        legacy = user.get("user_id")
        if legacy is not None:
            ids.add(legacy)
            ids.add(str(legacy))
    res = list(ids)
    _RESOLVED_USER_IDS_CACHE[mongo_user_id] = res
    return res

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
        local_dt = dt + timedelta(minutes=330)
        return local_dt
    except Exception:
        return None

def _resolve_session_telemetry_details_internal(s, session_apps, session_sites, state_doc=None):
    from database.mongodb import sessions_collection
    sid_str = str(s["_id"])
    start_str = s.get("start_time")
    if not start_str:
        return 0.0, 0.0, 0.0, 0.0, 0.0, 0.0

    try:
        temp_start_str = start_str[:-1] + "+00:00" if start_str.endswith("Z") else start_str
        start_dt = datetime.fromisoformat(temp_start_str)
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=timezone.utc)
    except Exception:
        return 0.0, 0.0, 0.0, 0.0, 0.0, 0.0

    end_str = s.get("end_time")
    if end_str:
        try:
            temp_end_str = end_str[:-1] + "+00:00" if end_str.endswith("Z") else end_str
            end_dt = datetime.fromisoformat(temp_end_str)
            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=timezone.utc)
            total_seconds = max(0.0, float((end_dt - start_dt).total_seconds()))
        except Exception:
            total_seconds = 0.0
    else:
        uid = str(s.get("user_id"))
        if not state_doc:
            from database.mongodb import monitoring_states_collection
            state_doc = monitoring_states_collection.find_one({"user_id": uid})
        if state_doc and (str(state_doc.get("current_session_id")) == sid_str or state_doc.get("current_state") == "RUNNING"):
            try:
                from routes.monitoring import calculate_elapsed_seconds
                total_seconds = float(calculate_elapsed_seconds(state_doc))
            except Exception:
                total_seconds = 0.0
        else:
            total_seconds = 0.0

    # LockApp seconds
    locked_seconds = 0.0
    other_apps = []
    for app in session_apps:
        name = app.get("app_name") or app.get("application_name") or ""
        dur = app.get("duration_seconds") or app.get("duration") or 0.0
        if "lockapp" in name.lower():
            locked_seconds += dur
        else:
            other_apps.append(app)

    locked_mins = round(locked_seconds / 60.0, 2)
    if s.get("locked_minutes") != locked_mins:
        sessions_collection.update_one({"_id": s["_id"]}, {"$set": {"locked_minutes": locked_mins}})
        s["locked_minutes"] = locked_mins

    # Classify websites
    prod_site_sec = 0.0
    neutral_site_sec = 0.0
    unprod_site_sec = 0.0
    for site in session_sites:
        dom = site.get("domain") or site.get("website") or ""
        title = site.get("page_title") or site.get("title") or ""
        dur = site.get("duration_seconds") or site.get("duration") or 0.0
        cat = classify_website_new(dom, title)
        if cat == "productive":
            prod_site_sec += dur
        elif cat == "unproductive":
            unprod_site_sec += dur
        else:
            neutral_site_sec += dur

    # Classify apps
    prod_app_sec = 0.0
    neutral_app_sec = 0.0
    unprod_app_sec = 0.0
    has_websites = len(session_sites) > 0
    for app in other_apps:
        name = app.get("app_name") or app.get("application_name") or ""
        title = app.get("window_title") or app.get("title") or ""
        dur = app.get("duration_seconds") or app.get("duration") or 0.0
        
        if is_browser(name):
            if has_websites:
                continue
            else:
                cat = classify_app_by_title_and_name(name, title)
        else:
            cat = classify_app_by_title_and_name(name, title)
            
        if cat == "productive":
            prod_app_sec += dur
        elif cat == "unproductive":
            unprod_app_sec += dur
        else:
            neutral_app_sec += dur

    prod_sec = prod_site_sec + prod_app_sec
    neutral_sec = neutral_site_sec + neutral_app_sec
    unprod_sec = unprod_site_sec + unprod_app_sec
    
    available_sec = max(0.0, total_seconds - locked_seconds)
    active_sec = prod_sec + neutral_sec + unprod_sec
    if active_sec > available_sec:
        if active_sec > 0.0:
            ratio = available_sec / active_sec
            prod_sec = prod_sec * ratio
            neutral_sec = neutral_sec * ratio
            unprod_sec = unprod_sec * ratio
        else:
            prod_sec = neutral_sec = unprod_sec = 0.0
        active_sec = available_sec
        
    idle_sec = max(0.0, total_seconds - active_sec - locked_seconds)
    
    return prod_sec, neutral_sec, unprod_sec, idle_sec, locked_seconds, total_seconds

def _calculate_daily_telemetry_raw(user_id, date_str, state_doc=None):
    from database.mongodb import sessions_collection, applications_collection, websites_collection, monitoring_states_collection
    
    resolved_ids = _resolve_user_ids(user_id)
    
    dt_parsed = datetime.strptime(date_str, "%Y-%m-%d")
    ist_start = datetime(dt_parsed.year, dt_parsed.month, dt_parsed.day, 0, 0, 0)
    utc_start = ist_start - timedelta(minutes=330)
    oldest_possible_utc = (utc_start - timedelta(days=1)).isoformat()
    
    sessions = list(sessions_collection.find({
        "user_id": {"$in": resolved_ids},
        "start_time": {"$gte": oldest_possible_utc}
    }))
    
    target_sessions = [
        s for s in sessions 
        if _utc_to_local_ist(s.get("start_time")) and _utc_to_local_ist(s.get("start_time")).strftime("%Y-%m-%d") == date_str
    ]
    
    if not target_sessions:
        return {
            "user_id": str(user_id),
            "date": date_str,
            "productivity": 0,
            "productive_minutes": 0.0,
            "neutral_minutes": 0.0,
            "unproductive_minutes": 0.0,
            "tracked_minutes": 0.0,
            "active_minutes": 0.0,
            "idle_minutes": 0.0,
            "locked_minutes": 0.0,
            "efficiency_ratio": 0.0,
            "activity_ratio": 0.0,
            "productive_apps": [],
            "neutral_apps": [],
            "unproductive_apps": [],
            "productive_sites": [],
            "neutral_sites": [],
            "unproductive_sites": []
        }
        
    target_session_oids = {s["_id"] for s in target_sessions}
    target_session_strs = {str(s["_id"]) for s in target_sessions}
    
    app_query = {
        "user_id": {"$in": resolved_ids},
        "start_time": {"$gte": oldest_possible_utc}
    }
    site_query = {
        "user_id": {"$in": resolved_ids},
        "start_time": {"$gte": oldest_possible_utc}
    }
    
    apps = list(applications_collection.find(
        app_query,
        {"session_id": 1, "duration_seconds": 1, "duration": 1, "app_name": 1, "application_name": 1, "start_time": 1, "user_id": 1, "window_title": 1, "title": 1}
    ))
    sites = list(websites_collection.find(
        site_query,
        {"session_id": 1, "duration_seconds": 1, "duration": 1, "domain": 1, "website": 1, "start_time": 1, "user_id": 1, "page_title": 1, "title": 1}
    ))
    
    filtered_apps = []
    for app in apps:
        local_dt = _utc_to_local_ist(app.get("start_time"))
        if local_dt and local_dt.strftime("%Y-%m-%d") == date_str:
            filtered_apps.append(app)
            
    filtered_sites = []
    for site in sites:
        local_dt = _utc_to_local_ist(site.get("start_time"))
        if local_dt and local_dt.strftime("%Y-%m-%d") == date_str:
            filtered_sites.append(site)
            
    preloaded_apps_for_sessions = defaultdict(list)
    for app in filtered_apps:
        sid = app.get("session_id")
        if sid:
            sid_str = str(sid)
            if sid_str in target_session_strs or sid in target_session_oids:
                preloaded_apps_for_sessions[sid_str].append(app)
                
    preloaded_sites_for_sessions = defaultdict(list)
    for site in filtered_sites:
        sid = site.get("session_id")
        if sid:
            sid_str = str(sid)
            if sid_str in target_session_strs or sid in target_session_oids:
                preloaded_sites_for_sessions[sid_str].append(site)
                
    total_prod_sec = 0.0
    total_neutral_sec = 0.0
    total_unprod_sec = 0.0
    total_idle_sec = 0.0
    total_locked_sec = 0.0
    total_sec = 0.0
    
    if state_doc is None:
        state_doc = monitoring_states_collection.find_one({"user_id": str(user_id)})
    for s in target_sessions:
        sid_str = str(s["_id"])
        session_apps = preloaded_apps_for_sessions.get(sid_str, [])
        session_sites = preloaded_sites_for_sessions.get(sid_str, [])
        
        prod_sec, neutral_sec, unprod_sec, idle_sec, locked_sec, total_seconds = _resolve_session_telemetry_details_internal(
            s, session_apps, session_sites, state_doc=state_doc
        )
        
        total_prod_sec += prod_sec
        total_neutral_sec += neutral_sec
        total_unprod_sec += unprod_sec
        total_idle_sec += idle_sec
        total_locked_sec += locked_sec
        total_sec += total_seconds
        
    productive_minutes = total_prod_sec / 60.0
    neutral_minutes = total_neutral_sec / 60.0
    unproductive_minutes = total_unprod_sec / 60.0
    idle_minutes = total_idle_sec / 60.0
    locked_minutes = total_locked_sec / 60.0
    
    active_minutes = productive_minutes + neutral_minutes + unproductive_minutes
    tracked_minutes = active_minutes + idle_minutes + locked_minutes
    
    if tracked_minutes > 0:
        weighted_prod_mins = productive_minutes * 1.0 + neutral_minutes * 0.5
        efficiency_ratio = round(weighted_prod_mins / tracked_minutes, 4)
        activity_ratio = round(active_minutes / tracked_minutes, 4)
        
        score = (0.70 * efficiency_ratio + 0.30 * activity_ratio) * 100.0
        productivity = int(round(max(0.0, min(100.0, score))))
    else:
        efficiency_ratio = 0.0
        activity_ratio = 0.0
        productivity = 0

    # Build apps lists
    app_durations = defaultdict(int)
    for app in filtered_apps:
        name = app.get("app_name") or app.get("application_name") or "No Application Metadata"
        if name == "Unknown":
            name = "No Application Metadata"
        if "lockapp" in name.lower():
            continue
        app_durations[name] += app.get("duration_seconds") or app.get("duration") or 0

    productive_apps = []
    neutral_apps = []
    unproductive_apps = []
    
    total_app_sec = sum(app_durations.values())
    for name, dur in app_durations.items():
        wt = ""
        for a in filtered_apps:
            if (a.get("app_name") or a.get("application_name")) == name:
                wt = a.get("window_title") or a.get("title") or ""
                if wt:
                    break
        cat = classify_app_by_title_and_name(name, wt)
        pct = round((dur / total_app_sec) * 100) if total_app_sec > 0 else 0
        app_obj = {"name": name, "duration": dur, "percentage": pct, "category": cat}
        
        if cat == "productive":
            productive_apps.append(app_obj)
        elif cat == "unproductive":
            unproductive_apps.append(app_obj)
        else:
            neutral_apps.append(app_obj)
            
    # Build sites lists
    site_durations = defaultdict(int)
    for site in filtered_sites:
        domain = site.get("domain") or site.get("website") or "Unknown"
        site_durations[domain] += site.get("duration_seconds") or site.get("duration") or 0

    productive_sites = []
    neutral_sites = []
    unproductive_sites = []
    
    total_site_sec = sum(site_durations.values())
    for domain, dur in site_durations.items():
        title = ""
        for s in filtered_sites:
            if (s.get("domain") or s.get("website")) == domain:
                title = s.get("page_title") or s.get("title") or ""
                if title:
                    break
        cat = classify_website_new(domain, title)
        pct = round((dur / total_site_sec) * 100) if total_site_sec > 0 else 0
        site_obj = {"domain": domain, "duration": dur, "percentage": pct, "category": cat}
        
        if cat == "productive":
            productive_sites.append(site_obj)
        elif cat == "unproductive":
            unproductive_sites.append(site_obj)
        else:
            neutral_sites.append(site_obj)

    productive_apps.sort(key=lambda x: x["duration"], reverse=True)
    neutral_apps.sort(key=lambda x: x["duration"], reverse=True)
    unproductive_apps.sort(key=lambda x: x["duration"], reverse=True)
    productive_sites.sort(key=lambda x: x["duration"], reverse=True)
    neutral_sites.sort(key=lambda x: x["duration"], reverse=True)
    unproductive_sites.sort(key=lambda x: x["duration"], reverse=True)

    return {
        "user_id": str(user_id),
        "date": date_str,
        "productivity": productivity,
        "productive_minutes": round(productive_minutes, 1),
        "neutral_minutes": round(neutral_minutes, 1),
        "unproductive_minutes": round(unproductive_minutes, 1),
        "tracked_minutes": round(tracked_minutes, 1),
        "active_minutes": round(active_minutes, 1),
        "idle_minutes": round(idle_minutes, 1),
        "locked_minutes": round(locked_minutes, 1),
        "efficiency_ratio": efficiency_ratio,
        "activity_ratio": activity_ratio,
        "productive_apps": productive_apps,
        "neutral_apps": neutral_apps,
        "unproductive_apps": unproductive_apps,
        "productive_sites": productive_sites,
        "neutral_sites": neutral_sites,
        "unproductive_sites": unproductive_sites
    }

def get_daily_summary(user_id, date_str, preloaded_summaries=None, state_doc=None):
    from database.mongodb import db
    daily_summaries_collection = db["daily_summaries"]
    
    today_local_dt = datetime.utcnow() + timedelta(minutes=330)
    today_str = today_local_dt.strftime("%Y-%m-%d")
    
    user_id_str = str(user_id)
    
    try:
        from flask import has_app_context, g
        use_g = has_app_context()
    except ImportError:
        use_g = False
        
    if use_g:
        if not hasattr(g, 'daily_summaries_cache'):
            g.daily_summaries_cache = {}
        cache_key = f"{user_id_str}:{date_str}"
        if cache_key in g.daily_summaries_cache:
            return g.daily_summaries_cache[cache_key]
            
    def _return_with_cache(data):
        if use_g:
            g.daily_summaries_cache[cache_key] = data
        return data

    if date_str == today_str:
        summary = _calculate_daily_telemetry_raw(user_id, date_str, state_doc=state_doc)
        daily_summaries_collection.update_one(
            {"user_id": user_id_str, "date": date_str},
            {"$set": summary},
            upsert=True
        )
        return _return_with_cache(summary)
        
    if preloaded_summaries is not None and date_str in preloaded_summaries:
        return _return_with_cache(preloaded_summaries[date_str])
        
    cached = daily_summaries_collection.find_one({"user_id": user_id_str, "date": date_str})
    if cached:
        cached.pop("_id", None)
        return _return_with_cache(cached)
        
    summary = _calculate_daily_telemetry_raw(user_id, date_str, state_doc=state_doc)
    daily_summaries_collection.update_one(
        {"user_id": user_id_str, "date": date_str},
        {"$set": summary},
        upsert=True
    )
    return _return_with_cache(summary)

def _empty_summary(user_id, scope=None):
    return {
        "user_id": str(user_id),
        "date": scope if isinstance(scope, str) and len(scope) == 10 and scope.count('-') == 2 else None,
        "productivity": 0,
        "productive_minutes": 0.0,
        "neutral_minutes": 0.0,
        "unproductive_minutes": 0.0,
        "tracked_minutes": 0.0,
        "active_minutes": 0.0,
        "idle_minutes": 0.0,
        "locked_minutes": 0.0,
        "efficiency_ratio": 0.0,
        "activity_ratio": 0.0,
        "productive_apps": [],
        "neutral_apps": [],
        "unproductive_apps": [],
        "productive_sites": [],
        "neutral_sites": [],
        "unproductive_sites": []
    }

def calculate_productivity(user_id, scope, session_id=None, preloaded_summaries=None, state_doc=None):
    from database.mongodb import sessions_collection, applications_collection, websites_collection, monitoring_states_collection

    resolved_ids = _resolve_user_ids(user_id)
    today_local_dt = datetime.utcnow() + timedelta(minutes=330)
    today_str = today_local_dt.strftime("%Y-%m-%d")

    dates = []
    is_session = False
    target_session = None

    if isinstance(scope, (list, tuple, set)):
        dates = sorted(list(scope))
    elif isinstance(scope, str):
        scope_lower = scope.lower()
        if scope_lower in ("today", "today_scope"):
            dates = [today_str]
        elif scope_lower in ("week", "week_scope"):
            dates = [(today_local_dt - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
            dates.reverse()
        elif scope_lower in ("all_time", "all_time_scope"):
            sessions = list(sessions_collection.find({"user_id": {"$in": resolved_ids}}))
            user_dates = set()
            for s in sessions:
                local_dt = _utc_to_local_ist(s.get("start_time"))
                if local_dt:
                    user_dates.add(local_dt.strftime("%Y-%m-%d"))
                elif s.get("start_time") and len(s.get("start_time")) >= 10:
                    user_dates.add(s.get("start_time")[:10])
            dates = sorted(list(user_dates))
        elif len(scope) == 10 and scope.count('-') == 2 and scope.split('-')[0].isdigit():
            dates = [scope]
        else:
            # Check if scope is session ID
            session = None
            if ObjectId.is_valid(scope):
                session = sessions_collection.find_one({"_id": ObjectId(scope)})
            if not session:
                session = sessions_collection.find_one({"_id": scope})
            if not session:
                try:
                    session = sessions_collection.find_one({"_id": int(scope)})
                except (ValueError, TypeError):
                    pass
            if session:
                is_session = True
                target_session = session
            else:
                dates = [scope]
    else:
        dates = [today_str]

    if is_session and target_session:
        sid = target_session["_id"]
        session_apps = list(applications_collection.find({"session_id": {"$in": [sid, str(sid)]}}))
        session_sites = list(websites_collection.find({"session_id": {"$in": [sid, str(sid)]}}))
        
        if state_doc is None:
            state_doc = monitoring_states_collection.find_one({"user_id": str(user_id)})
        prod_sec, neutral_sec, unprod_sec, idle_sec, locked_sec, total_seconds = _resolve_session_telemetry_details_internal(
            target_session, session_apps, session_sites, state_doc=state_doc
        )
        
        productive_minutes = prod_sec / 60.0
        neutral_minutes = neutral_sec / 60.0
        unproductive_minutes = unprod_sec / 60.0
        idle_minutes = idle_sec / 60.0
        locked_minutes = locked_sec / 60.0
        
        active_minutes = productive_minutes + neutral_minutes + unproductive_minutes
        tracked_minutes = active_minutes + idle_minutes + locked_minutes
        
        if tracked_minutes > 0:
            weighted_prod_mins = productive_minutes * 1.0 + neutral_minutes * 0.5
            efficiency_ratio = round(weighted_prod_mins / tracked_minutes, 4)
            activity_ratio = round(active_minutes / tracked_minutes, 4)
            
            score = (0.70 * efficiency_ratio + 0.30 * activity_ratio) * 100.0
            productivity = int(round(max(0.0, min(100.0, score))))
        else:
            efficiency_ratio = 0.0
            activity_ratio = 0.0
            productivity = 0

        app_durations = defaultdict(int)
        for app in session_apps:
            name = app.get("app_name") or app.get("application_name") or "No Application Metadata"
            if name == "Unknown":
                name = "No Application Metadata"
            if "lockapp" in name.lower():
                continue
            app_durations[name] += app.get("duration_seconds") or app.get("duration") or 0

        productive_apps = []
        neutral_apps = []
        unproductive_apps = []
        
        total_app_sec = sum(app_durations.values())
        for name, dur in app_durations.items():
            wt = ""
            for a in session_apps:
                if (a.get("app_name") or a.get("application_name")) == name:
                    wt = a.get("window_title") or a.get("title") or ""
                    if wt:
                        break
            cat = classify_app_by_title_and_name(name, wt)
            pct = round((dur / total_app_sec) * 100) if total_app_sec > 0 else 0
            app_obj = {"name": name, "duration": dur, "percentage": pct, "category": cat}
            
            if cat == "productive":
                productive_apps.append(app_obj)
            elif cat == "unproductive":
                unproductive_apps.append(app_obj)
            else:
                neutral_apps.append(app_obj)
                
        site_durations = defaultdict(int)
        for site in session_sites:
            domain = site.get("domain") or site.get("website") or "Unknown"
            site_durations[domain] += site.get("duration_seconds") or site.get("duration") or 0

        productive_sites = []
        neutral_sites = []
        unproductive_sites = []
        
        total_site_sec = sum(site_durations.values())
        for domain, dur in site_durations.items():
            title = ""
            for s in session_sites:
                if (s.get("domain") or s.get("website")) == domain:
                    title = s.get("page_title") or s.get("title") or ""
                    if title:
                        break
            cat = classify_website_new(domain, title)
            pct = round((dur / total_site_sec) * 100) if total_site_sec > 0 else 0
            site_obj = {"domain": domain, "duration": dur, "percentage": pct, "category": cat}
            
            if cat == "productive":
                productive_sites.append(site_obj)
            elif cat == "unproductive":
                unproductive_sites.append(site_obj)
            else:
                neutral_sites.append(site_obj)

        productive_apps.sort(key=lambda x: x["duration"], reverse=True)
        neutral_apps.sort(key=lambda x: x["duration"], reverse=True)
        unproductive_apps.sort(key=lambda x: x["duration"], reverse=True)
        productive_sites.sort(key=lambda x: x["duration"], reverse=True)
        neutral_sites.sort(key=lambda x: x["duration"], reverse=True)
        unproductive_sites.sort(key=lambda x: x["duration"], reverse=True)

        return {
            "user_id": str(user_id),
            "session_id": str(sid),
            "productivity": productivity,
            "productive_minutes": round(productive_minutes, 1),
            "neutral_minutes": round(neutral_minutes, 1),
            "unproductive_minutes": round(unproductive_minutes, 1),
            "tracked_minutes": round(tracked_minutes, 1),
            "active_minutes": round(active_minutes, 1),
            "idle_minutes": round(idle_minutes, 1),
            "locked_minutes": round(locked_minutes, 1),
            "efficiency_ratio": efficiency_ratio,
            "activity_ratio": activity_ratio,
            "productive_apps": productive_apps,
            "neutral_apps": neutral_apps,
            "unproductive_apps": unproductive_apps,
            "productive_sites": productive_sites,
            "neutral_sites": neutral_sites,
            "unproductive_sites": unproductive_sites
        }

    if not dates:
        return _empty_summary(user_id, scope)

    if state_doc is None:
        state_doc = monitoring_states_collection.find_one({"user_id": str(user_id)})
    
    user_id_str = str(user_id)
    preloaded_summaries_user = {}
    
    if preloaded_summaries is not None:
        for d in dates:
            if (user_id_str, d) in preloaded_summaries:
                preloaded_summaries_user[d] = preloaded_summaries[(user_id_str, d)]
    else:
        past_dates = [d for d in dates if d != today_str]
        if past_dates:
            from database.mongodb import db
            daily_summaries_collection = db["daily_summaries"]
            cursor = daily_summaries_collection.find({"user_id": user_id_str, "date": {"$in": past_dates}})
            for doc in cursor:
                doc.pop("_id", None)
                preloaded_summaries_user[doc["date"]] = doc

    summaries = []
    for d_str in dates:
        summ = get_daily_summary(user_id, d_str, preloaded_summaries=preloaded_summaries_user, state_doc=state_doc)
        summaries.append(summ)
        
    combined = {
        "productivity": 0,
        "productive_minutes": 0.0,
        "neutral_minutes": 0.0,
        "unproductive_minutes": 0.0,
        "tracked_minutes": 0.0,
        "active_minutes": 0.0,
        "idle_minutes": 0.0,
        "locked_minutes": 0.0,
        "efficiency_ratio": 0.0,
        "activity_ratio": 0.0,
        "productive_apps": [],
        "neutral_apps": [],
        "unproductive_apps": [],
        "productive_sites": [],
        "neutral_sites": [],
        "unproductive_sites": []
    }
    
    app_durations = defaultdict(int)
    site_durations = defaultdict(int)
    
    for s in summaries:
        combined["productive_minutes"] += s.get("productive_minutes", 0.0)
        combined["neutral_minutes"] += s.get("neutral_minutes", 0.0)
        combined["unproductive_minutes"] += s.get("unproductive_minutes", 0.0)
        combined["tracked_minutes"] += s.get("tracked_minutes", 0.0)
        combined["active_minutes"] += s.get("active_minutes", 0.0)
        combined["idle_minutes"] += s.get("idle_minutes", 0.0)
        combined["locked_minutes"] += s.get("locked_minutes", 0.0)
        
        for app in s.get("productive_apps", []):
            app_durations[app["name"]] += app["duration"]
        for app in s.get("neutral_apps", []):
            app_durations[app["name"]] += app["duration"]
        for app in s.get("unproductive_apps", []):
            app_durations[app["name"]] += app["duration"]
            
        for site in s.get("productive_sites", []):
            site_durations[site["domain"]] += site["duration"]
        for site in s.get("neutral_sites", []):
            site_durations[site["domain"]] += site["duration"]
        for site in s.get("unproductive_sites", []):
            site_durations[site["domain"]] += site["duration"]

    tracked_mins = combined["tracked_minutes"]
    prod_mins = combined["productive_minutes"]
    neutral_mins = combined["neutral_minutes"]
    
    if tracked_mins > 0:
        weighted_prod_mins = prod_mins * 1.0 + neutral_mins * 0.5
        combined["efficiency_ratio"] = round(weighted_prod_mins / tracked_mins, 4)
        combined["activity_ratio"] = round(combined["active_minutes"] / tracked_mins, 4)
        
        score = (0.70 * combined["efficiency_ratio"] + 0.30 * combined["activity_ratio"]) * 100.0
        combined["productivity"] = int(round(max(0.0, min(100.0, score))))
    else:
        combined["efficiency_ratio"] = 0.0
        combined["activity_ratio"] = 0.0
        combined["productivity"] = 0

    total_app_sec = sum(app_durations.values())
    for name, dur in app_durations.items():
        wt = ""
        cat = classify_app_by_title_and_name(name, wt)
        pct = round((dur / total_app_sec) * 100) if total_app_sec > 0 else 0
        app_obj = {"name": name, "duration": dur, "percentage": pct, "category": cat}
        
        if cat == "productive":
            combined["productive_apps"].append(app_obj)
        elif cat == "unproductive":
            combined["unproductive_apps"].append(app_obj)
        else:
            combined["neutral_apps"].append(app_obj)
            
    total_site_sec = sum(site_durations.values())
    for domain, dur in site_durations.items():
        title = ""
        cat = classify_website_new(domain, title)
        pct = round((dur / total_site_sec) * 100) if total_site_sec > 0 else 0
        site_obj = {"domain": domain, "duration": dur, "percentage": pct, "category": cat}
        
        if cat == "productive":
            combined["productive_sites"].append(site_obj)
        elif cat == "unproductive":
            combined["unproductive_sites"].append(site_obj)
        else:
            combined["neutral_sites"].append(site_obj)
            
    combined["productive_apps"].sort(key=lambda x: x["duration"], reverse=True)
    combined["neutral_apps"].sort(key=lambda x: x["duration"], reverse=True)
    combined["unproductive_apps"].sort(key=lambda x: x["duration"], reverse=True)
    combined["productive_sites"].sort(key=lambda x: x["duration"], reverse=True)
    combined["neutral_sites"].sort(key=lambda x: x["duration"], reverse=True)
    combined["unproductive_sites"].sort(key=lambda x: x["duration"], reverse=True)
    
    combined["productive_minutes"] = round(combined["productive_minutes"], 1)
    combined["neutral_minutes"] = round(combined["neutral_minutes"], 1)
    combined["unproductive_minutes"] = round(combined["unproductive_minutes"], 1)
    combined["tracked_minutes"] = round(combined["tracked_minutes"], 1)
    combined["active_minutes"] = round(combined["active_minutes"], 1)
    combined["idle_minutes"] = round(combined["idle_minutes"], 1)
    combined["locked_minutes"] = round(combined["locked_minutes"], 1)
    
    return combined