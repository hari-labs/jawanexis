from flask import Blueprint, request, jsonify
from database.mongodb import users_collection, sessions_collection, monitoring_states_collection, devices_collection
from bson import ObjectId
from datetime import datetime, timezone

monitoring_bp = Blueprint("monitoring", __name__, url_prefix="/monitoring")

def get_caller_user():
    caller_id = request.headers.get("X-User-Id")
    if not caller_id:
        return None
    try:
        if ObjectId.is_valid(caller_id):
            user = users_collection.find_one({"_id": ObjectId(caller_id)})
            if user:
                user["id"] = str(user["_id"])
                return user
        user = users_collection.find_one({"_id": caller_id})
        if user:
            user["id"] = str(user["_id"])
            return user
    except Exception:
        pass
    return None

def _utcnow():
    """Return timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)

def _parse_dt(s):
    """Parse an ISO datetime string, handling both naive and aware formats."""
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None

def check_agent_online(state_doc):
    if not state_doc:
        return False
    lh = state_doc.get("last_heartbeat")
    if not lh:
        return False
    dt = _parse_dt(lh)
    if dt is None:
        return False
    diff = (_utcnow() - dt).total_seconds()
    is_online = diff < 30
    if is_online != state_doc.get("agent_online", False):
        monitoring_states_collection.update_one(
            {"_id": state_doc["_id"]},
            {"$set": {"agent_online": is_online}}
        )
    return is_online

def _auto_reset_stuck_state(state_doc):
    """
    If a state is stuck in a transition (STARTING, PAUSING, RESUMING, STOPPING)
    and the agent has not sent a heartbeat for > 60 seconds, reset to a safe state.
    """
    if not state_doc:
        return state_doc

    current = state_doc.get("current_state", "IDLE")
    transition_states = {"STARTING", "PAUSING", "RESUMING", "STOPPING"}
    if current not in transition_states:
        return state_doc

    lh = state_doc.get("last_heartbeat")
    if not lh:
        # No heartbeat ever — reset to IDLE
        _reset_to_idle(state_doc)
        state_doc["current_state"] = "IDLE"
        state_doc["pending_command"] = None
        return state_doc

    dt = _parse_dt(lh)
    if dt is None:
        return state_doc

    diff = (_utcnow() - dt).total_seconds()
    if diff > 60:
        # Agent has been offline for 60s while stuck in a transition — reset
        print(f"[AUTO-RESET] Stuck state {current} for user {state_doc.get('user_id')} — resetting to IDLE (last heartbeat {diff:.0f}s ago)")
        _reset_to_idle(state_doc)
        state_doc["current_state"] = "IDLE"
        state_doc["pending_command"] = None

    return state_doc

def _reset_to_idle(state_doc):
    now_str = _utcnow().isoformat()
    # Close any orphaned session
    sess_id = state_doc.get("current_session_id")
    if sess_id:
        sessions_collection.update_one(
            {"_id": ObjectId(sess_id) if ObjectId.is_valid(sess_id) else sess_id, "status": {"$ne": "ENDED"}},
            {"$set": {"status": "ENDED", "end_time": now_str}}
        )
    monitoring_states_collection.update_one(
        {"_id": state_doc["_id"]},
        {"$set": {
            "current_state": "IDLE",
            "pending_command": None,
            "current_session_id": None,
            "started_at": None,
            "last_resumed_at": None,
            "accumulated_seconds": 0,
            "last_updated": now_str
        }}
    )

def calculate_elapsed_seconds(state_doc):
    if not state_doc:
        return 0
    state = state_doc.get("current_state", "IDLE")
    if state in ["STOPPED", "IDLE", "STARTING", "STOPPING", "PAUSING", "RESUMING"]:
        return state_doc.get("accumulated_seconds", 0)
    accumulated = state_doc.get("accumulated_seconds", 0)
    if state == "RUNNING":
        last_resumed_str = state_doc.get("last_resumed_at") or state_doc.get("started_at")
        dt = _parse_dt(last_resumed_str)
        if dt:
            diff = int((_utcnow() - dt).total_seconds())
            return max(0, accumulated + diff)
    if state == "PAUSED":
        return max(0, accumulated)
    return max(0, accumulated)

@monitoring_bp.route("/agent/register", methods=["POST"])
def register_agent():
    data = request.json or {}
    device_uuid = data.get("device_uuid")
    hostname = data.get("hostname", "Unknown")
    os_version = data.get("os", "Unknown")
    
    if not device_uuid:
        return jsonify({"success": False, "message": "Missing device_uuid"}), 400
        
    device = devices_collection.find_one({"device_uuid": device_uuid})
    now_str = _utcnow().isoformat()
    
    if not device:
        device = {
            "device_uuid": device_uuid,
            "hostname": hostname,
            "os_version": os_version,
            "status": "pending",
            "assigned_user_id": None,
            "registered_at": now_str,
            "last_seen_at": now_str
        }
        devices_collection.insert_one(device)
    else:
        devices_collection.update_one(
            {"_id": device["_id"]},
            {"$set": {"last_seen_at": now_str, "hostname": hostname, "os_version": os_version}}
        )
        
    return jsonify({
        "success": True, 
        "status": device.get("status", "pending"),
        "message": "Device registered successfully."
    })

@monitoring_bp.route("/command", methods=["POST"])
def send_command():
    caller = get_caller_user()
    if not caller:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    data = request.json or {}
    user_id = data.get("user_id")
    command = data.get("command")  # START, PAUSE, RESUME, STOP
    
    if not user_id or not command:
        return jsonify({"success": False, "message": "Missing user_id or command"}), 400
        
    if command not in ["START", "PAUSE", "RESUME", "STOP"]:
        return jsonify({"success": False, "message": "Invalid command"}), 400
        
    # Authorization: Users can only control their own monitoring
    if caller["id"] != user_id:
        return jsonify({"success": False, "message": "Forbidden: You can only control your own monitoring"}), 403
        
    # Resolve user
    user = users_collection.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
        
    state_doc = monitoring_states_collection.find_one({"user_id": user_id})
    # Auto-reset any stuck transition states before acting
    if state_doc:
        state_doc = _auto_reset_stuck_state(state_doc)

    now_str = _utcnow().isoformat()
    
    if command == "START":
        current = state_doc.get("current_state", "IDLE") if state_doc else "IDLE"
        if current in ["RUNNING", "PAUSED", "STARTING", "RESUMING"]:
            return jsonify({"success": False, "message": f"Monitoring is already active (state: {current})"}), 400
            
        # Create a new session in MongoDB immediately so the agent can map to it
        session_doc = {
            "user_id": user_id,
            "email": user.get("email"),
            "role": user.get("role", "intern"),
            "start_time": now_str,
            "end_time": None,
            "status": "ACTIVE",
            "active_minutes": 0,
            "idle_minutes": 0
        }
        sessions_collection.insert_one(session_doc)
        session_id = str(session_doc["_id"])
        
        # Set state to STARTING — agent will confirm by updating to RUNNING
        monitoring_states_collection.update_one(
            {"user_id": user_id},
            {"$set": {
                "current_state": "STARTING",
                "current_session_id": session_id,
                "started_at": now_str,
                "last_resumed_at": now_str,
                "accumulated_seconds": 0,
                "last_updated": now_str,
                "pending_command": "START",
                "agent_online": state_doc.get("agent_online", False) if state_doc else False
            }},
            upsert=True
        )
        return jsonify({"success": True, "message": "START command queued", "session_id": session_id})

    elif command == "PAUSE":
        if not state_doc or state_doc.get("current_state") != "RUNNING":
            current = state_doc.get("current_state", "IDLE") if state_doc else "IDLE"
            return jsonify({"success": False, "message": f"Can only pause a RUNNING session (current: {current})"}), 400
            
        last_resumed_str = state_doc.get("last_resumed_at") or state_doc.get("started_at") or now_str
        dt = _parse_dt(last_resumed_str)
        diff = int((_utcnow() - dt).total_seconds()) if dt else 0
        accumulated = state_doc.get("accumulated_seconds", 0) + diff
        
        monitoring_states_collection.update_one(
            {"user_id": user_id},
            {"$set": {
                "current_state": "PAUSING",
                "accumulated_seconds": accumulated,
                "last_updated": now_str,
                "pending_command": "PAUSE"
            }}
        )
    elif command == "RESUME":
        if not state_doc or state_doc.get("current_state") != "PAUSED":
            current = state_doc.get("current_state", "IDLE") if state_doc else "IDLE"
            return jsonify({"success": False, "message": f"Can only resume a PAUSED session (current: {current})"}), 400
            
        monitoring_states_collection.update_one(
            {"user_id": user_id},
            {"$set": {
                "current_state": "RESUMING",
                "last_resumed_at": now_str,
                "last_updated": now_str,
                "pending_command": "RESUME"
            }}
        )
    elif command == "STOP":
        current = state_doc.get("current_state", "IDLE") if state_doc else "IDLE"
        if current in ["STOPPED", "IDLE"]:
            return jsonify({"success": False, "message": "No active session to stop"}), 400
            
        sess_id = state_doc.get("current_session_id") if state_doc else None
        if sess_id:
            sessions_collection.update_one(
                {"_id": ObjectId(sess_id) if ObjectId.is_valid(sess_id) else sess_id},
                {"$set": {"status": "ENDED", "end_time": now_str}}
            )
            
        monitoring_states_collection.update_one(
            {"user_id": user_id},
            {"$set": {
                "current_state": "STOPPING",
                "current_session_id": None,
                "started_at": None,
                "last_resumed_at": None,
                "accumulated_seconds": 0,
                "last_updated": now_str,
                "pending_command": "STOP"
            }}
        )
        
    return jsonify({"success": True, "message": f"Command {command} sent to Desktop Agent"})

@monitoring_bp.route("/status", methods=["GET"])
def get_all_status():
    caller = get_caller_user()
    if not caller or caller.get("role") not in ["admin", "team_lead"]:
        return jsonify({"success": False, "message": "Forbidden"}), 403
        
    # Bulk read all state documents to avoid N+1 query loops
    all_states = {s["user_id"]: s for s in monitoring_states_collection.find()}
    
    states = []
    for user in users_collection.find():
        user_id = str(user["_id"])
        state_doc = all_states.get(user_id)
        
        is_online = False
        state = "IDLE"
        started_at = None
        session_id = None
        last_seen = None
        elapsed_seconds = 0
        
        if state_doc:
            state_doc = _auto_reset_stuck_state(state_doc)
            is_online = check_agent_online(state_doc)
            state = state_doc.get("current_state", "IDLE")
            session_id = state_doc.get("current_session_id")
            started_at = state_doc.get("started_at")
            last_seen = state_doc.get("last_heartbeat")
            elapsed_seconds = calculate_elapsed_seconds(state_doc)
                    
        states.append({
            "user_id": user_id,
            "name": user.get("name", "Unknown"),
            "email": user.get("email", ""),
            "role": user.get("role", "intern"),
            "current_state": state,
            "current_session_id": session_id,
            "started_at": started_at,
            "elapsed_seconds": elapsed_seconds,
            "agent_online": is_online,
            "last_seen": last_seen
        })
        
    return jsonify(states)

@monitoring_bp.route("/status/<user_id>", methods=["GET"])
def get_status(user_id):
    caller = get_caller_user()
    if not caller:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    # Intern can only view own status
    if caller.get("role") == "intern" and caller["id"] != user_id:
        return jsonify({"success": False, "message": "Forbidden"}), 403
        
    state_doc = monitoring_states_collection.find_one({"user_id": user_id})
    if not state_doc:
        return jsonify({
            "user_id": user_id,
            "current_state": "IDLE",
            "current_session_id": None,
            "started_at": None,
            "elapsed_seconds": 0,
            "agent_online": False,
            "last_seen": None
        })

    # Auto-reset if stuck in transition state with no heartbeat
    state_doc = _auto_reset_stuck_state(state_doc)

    # Re-evaluate online status dynamically
    is_online = check_agent_online(state_doc)
    elapsed_seconds = calculate_elapsed_seconds(state_doc)
            
    return jsonify({
        "user_id": user_id,
        "current_state": state_doc.get("current_state", "IDLE"),
        "current_session_id": state_doc.get("current_session_id"),
        "started_at": state_doc.get("started_at"),
        "elapsed_seconds": elapsed_seconds,
        "agent_online": is_online,
        "last_seen": state_doc.get("last_heartbeat")
    })

@monitoring_bp.route("/agent/poll", methods=["GET"])
def agent_poll():
    """
    Called by the Desktop Agent on every poll interval.
    1. Updates last_heartbeat (marks agent online)
    2. Maps the agent's local state to the backend state
    3. Returns any pending_command to the agent
    4. Clears pending_command AFTER returning it (so agent receives it exactly once)
    """
    device_uuid = request.args.get("device_uuid")
    if not device_uuid:
        return jsonify({"success": False, "message": "device_uuid parameter required"}), 400
        
    device = devices_collection.find_one({"device_uuid": device_uuid})
    if not device:
        return jsonify({"success": False, "message": "Device not found"}), 404
        
    if device.get("status") != "approved" or not device.get("assigned_user_id"):
        return jsonify({"success": True, "status": device.get("status", "pending"), "command": None})
        
    user_id = str(device["assigned_user_id"])
    now_str = _utcnow().isoformat()
    
    agent_state = request.args.get("state", "IDLE")  # IDLE, ACTIVE, PAUSED, ENDED
    
    state_doc = monitoring_states_collection.find_one({"user_id": user_id})
    
    if not state_doc:
        # First poll from this agent — create the state doc
        state_doc = {
            "user_id": user_id,
            "current_state": "IDLE",
            "current_session_id": None,
            "started_at": None,
            "last_updated": now_str,
            "last_heartbeat": now_str,
            "agent_online": True,
            "pending_command": None,
            "accumulated_seconds": 0
        }
        monitoring_states_collection.insert_one(state_doc)
        print(f"[AGENT-POLL] New state created for {device_uuid}")
    else:
        pending = state_doc.get("pending_command")

        # Map agent's local state to backend confirmed state
        # Only update current_state if there is NO pending command (command already consumed)
        update_fields = {
            "last_heartbeat": now_str,
            "agent_online": True
        }

        if pending:
            # There's a command queued — keep the transition state visible in DB
            # Don't overwrite the current_state since it's in a transition
            print(f"[AGENT-POLL] Pending command for {device_uuid}: {pending}")
        else:
            # No command queued — reflect agent's actual local state
            state_map = {
                "ACTIVE": "RUNNING",
                "PAUSED": "PAUSED",
                "ENDED": "STOPPED",
                "IDLE": "IDLE"
            }
            mapped = state_map.get(agent_state, "IDLE")
            update_fields["current_state"] = mapped
            state_doc["current_state"] = mapped
            print(f"[AGENT-POLL] {device_uuid} state: agent={agent_state} -> backend={mapped}")

        monitoring_states_collection.update_one(
            {"_id": state_doc["_id"]},
            {"$set": update_fields}
        )

    # Consume and return the pending command
    command = state_doc.get("pending_command")
    session_id = state_doc.get("current_session_id")

    if command:
        # Clear the pending command NOW so it isn't sent twice
        monitoring_states_collection.update_one(
            {"_id": state_doc["_id"]},
            {"$set": {"pending_command": None}}
        )
        print(f"[AGENT-POLL] Dispatching command {command} to agent {device_uuid}, session={session_id}")
        
    res_data = {
        "success": True,
        "status": "approved",
        "current_state": state_doc.get("current_state", "IDLE"),
        "current_session_id": session_id,
        "command": command
    }
    return jsonify(res_data)

@monitoring_bp.route("/agent/confirm", methods=["POST"])
def agent_confirm():
    """
    Called by the Desktop Agent AFTER executing a command to confirm the state change.
    This prevents the stuck STARTING state when the agent processes a command.
    """
    data = request.json or {}
    device_uuid = data.get("device_uuid")
    confirmed_state = data.get("state")  # RUNNING, PAUSED, STOPPED, IDLE
    
    if not device_uuid or not confirmed_state:
        return jsonify({"success": False, "message": "device_uuid and state required"}), 400

    device = devices_collection.find_one({"device_uuid": device_uuid})
    if not device or device.get("status") != "approved" or not device.get("assigned_user_id"):
        return jsonify({"success": False, "message": "Device not approved"}), 403

    user_id = str(device["assigned_user_id"])
    now_str = _utcnow().isoformat()

    # Map agent-side confirmed states to backend states
    state_map = {
        "ACTIVE": "RUNNING",
        "PAUSED": "PAUSED",
        "ENDED": "STOPPED",
        "IDLE": "IDLE",
        "RUNNING": "RUNNING",
        "STOPPED": "STOPPED",
    }
    backend_state = state_map.get(confirmed_state, "IDLE")

    update_fields = {
        "current_state": backend_state,
        "last_heartbeat": now_str,
        "agent_online": True,
        "pending_command": None,
        "last_updated": now_str
    }

    if backend_state == "RUNNING":
        update_fields["last_resumed_at"] = now_str
    elif backend_state in ["STOPPED", "IDLE"]:
        update_fields["current_session_id"] = None
        update_fields["started_at"] = None
        update_fields["last_resumed_at"] = None
        update_fields["accumulated_seconds"] = 0

    monitoring_states_collection.update_one(
        {"user_id": user_id},
        {"$set": update_fields},
        upsert=True
    )
    print(f"[AGENT-CONFIRM] {device_uuid} confirmed state: {confirmed_state} -> {backend_state}")
    return jsonify({"success": True, "confirmed_state": backend_state})

@monitoring_bp.route("/agent/heartbeat", methods=["POST"])
def agent_heartbeat():
    data = request.json or {}
    device_uuid = data.get("device_uuid")
    if not device_uuid:
        return jsonify({"success": False, "message": "device_uuid is required"}), 400
        
    device = devices_collection.find_one({"device_uuid": device_uuid})
    if not device or device.get("status") != "approved" or not device.get("assigned_user_id"):
        return jsonify({"success": False, "message": "Device not approved"}), 403
        
    user_id = str(device["assigned_user_id"])
    now_str = _utcnow().isoformat()
    
    monitoring_states_collection.update_one(
        {"user_id": user_id},
        {"$set": {
            "last_heartbeat": now_str,
            "agent_online": True
        }},
        upsert=True
    )
    return jsonify({"success": True})

@monitoring_bp.route("/devices", methods=["GET"])
def get_devices():
    caller = get_caller_user()
    if not caller or caller.get("role") != "admin":
        return jsonify({"success": False, "message": "Unauthorized"}), 403
        
    devices = list(devices_collection.find({}))
    for d in devices:
        d["_id"] = str(d["_id"])
        
        # Hydrate with assigned user email/name if assigned
        assigned_user_id = d.get("assigned_user_id")
        if assigned_user_id:
            user = users_collection.find_one({"_id": ObjectId(assigned_user_id) if ObjectId.is_valid(assigned_user_id) else assigned_user_id})
            if user:
                d["assigned_user_email"] = user.get("email")
                d["assigned_user_name"] = user.get("name")
                
    return jsonify({"success": True, "devices": devices})

@monitoring_bp.route("/devices/<device_uuid>/assign", methods=["POST"])
def assign_device(device_uuid):
    caller = get_caller_user()
    if not caller or caller.get("role") != "admin":
        return jsonify({"success": False, "message": "Unauthorized"}), 403
        
    data = request.json or {}
    user_id = data.get("user_id")
    
    device = devices_collection.find_one({"device_uuid": device_uuid})
    if not device:
        return jsonify({"success": False, "message": "Device not found"}), 404
        
    if user_id:
        # Assign user
        user = users_collection.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404
            
        devices_collection.update_one(
            {"device_uuid": device_uuid},
            {"$set": {
                "assigned_user_id": str(user["_id"]),
                "status": "approved"
            }}
        )
    else:
        # Unassign user
        devices_collection.update_one(
            {"device_uuid": device_uuid},
            {"$set": {
                "assigned_user_id": None,
                "status": "pending"
            }}
        )
        
    return jsonify({"success": True})
