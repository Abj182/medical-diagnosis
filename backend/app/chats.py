from typing import List, Dict, Any
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from .supabase_client import get_supabase

chats_bp = Blueprint("chats", __name__)

TABLE = "chat_history"


def _uid() -> int:
	return int(get_jwt_identity())


@chats_bp.get("/list")
@jwt_required()
def list_chats():
	sb = get_supabase()
	res = sb.table(TABLE).select("id,title,tag,created_at").eq("user_id", _uid()).order("created_at", desc=True).execute()
	return {"chats": res.data or []}


@chats_bp.get("/get")
@jwt_required()
def get_chat():
	chat_id = request.args.get("id")
	if not chat_id:
		return {"error": "id required"}, 400
	sb = get_supabase()
	res = sb.table(TABLE).select("id,title,tag,messages,created_at").eq("user_id", _uid()).eq("id", chat_id).limit(1).execute()
	if not res.data:
		return {"error": "not found"}, 404
	return {"chat": res.data[0]}


@chats_bp.post("/create")
@jwt_required()
def create_chat():
	data = request.get_json(force=True)
	title = (data.get("title") or "New Chat").strip()
	tag = (data.get("tag") or "textbook").strip()
	sb = get_supabase()
	res = sb.table(TABLE).insert({
		"user_id": _uid(),
		"title": title or "New Chat",
		"tag": tag,
		"messages": [],
	}).execute()
	chat = res.data[0]
	return {"id": chat["id"], "title": chat["title"], "tag": chat.get("tag")}, 201


@chats_bp.post("/append")
@jwt_required()
def append_message():
	data = request.get_json(force=True)
	chat_id = data.get("id")
	role = data.get("role")
	text = data.get("text")
	if not chat_id or role not in ("user", "bot") or not text:
		return {"error": "id, role, text required"}, 400
	sb = get_supabase()
	# Fetch current
	cur = sb.table(TABLE).select("messages").eq("user_id", _uid()).eq("id", chat_id).limit(1).execute()
	if not cur.data:
		return {"error": "not found"}, 404
	msgs: List[Dict[str, Any]] = (cur.data[0].get("messages") or [])
	msgs.append({"role": role, "text": text})
	sb.table(TABLE).update({"messages": msgs}).eq("user_id", _uid()).eq("id", chat_id).execute()
	return {"ok": True}


@chats_bp.post("/rename")
@jwt_required()
def rename_chat():
	data = request.get_json(force=True)
	chat_id = data.get("id")
	title = (data.get("title") or "").strip()
	if not chat_id or not title:
		return {"error": "id and title required"}, 400
	sb = get_supabase()
	sb.table(TABLE).update({"title": title}).eq("user_id", _uid()).eq("id", chat_id).execute()
	return {"ok": True}


@chats_bp.delete("/delete")
@jwt_required()
def delete_chat():
	chat_id = request.args.get("id")
	if not chat_id:
		return {"error": "id required"}, 400
	sb = get_supabase()
	sb.table(TABLE).delete().eq("user_id", _uid()).eq("id", chat_id).execute()
	return {"ok": True}


@chats_bp.post("/clear")
@jwt_required()
def clear_all():
	sb = get_supabase()
	sb.table(TABLE).delete().eq("user_id", _uid()).execute()
	return {"ok": True}
