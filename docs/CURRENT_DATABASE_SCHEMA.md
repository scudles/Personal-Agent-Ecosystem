# 当前数据库结构（001增量审计）

核对时间：2026-11-12T01:47:48.369Z。Schema version=1，integrity_check=ok，foreign_key_check=0。

当前库由 data/workbench-config.json 的 databaseFile 指定；旧 bridge.sqlite / workflow.sqlite 未结构修改。

```sql
CREATE TABLE agents(id TEXT PRIMARY KEY,name TEXT NOT NULL);

CREATE TABLE audit(seq INTEGER PRIMARY KEY,at TEXT,kind TEXT,json TEXT);

CREATE TABLE authorizations(item_id TEXT NOT NULL,revision INTEGER NOT NULL,snapshot_hash TEXT NOT NULL,user_decision TEXT NOT NULL,note TEXT NOT NULL,at TEXT NOT NULL,PRIMARY KEY(item_id,revision));

CREATE TABLE bindings(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,workspace_id TEXT NOT NULL,agent_id TEXT NOT NULL,native_session_id TEXT NOT NULL UNIQUE,paused INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,UNIQUE(workspace_id,agent_id),FOREIGN KEY(workspace_id,project_id,agent_id) REFERENCES participants(workspace_id,project_id,agent_id),FOREIGN KEY(native_session_id,agent_id) REFERENCES native_sessions(id,agent_id));

CREATE TABLE entity_scope(kind TEXT NOT NULL,id TEXT NOT NULL,project_id TEXT NOT NULL,workspace_id TEXT NOT NULL,PRIMARY KEY(kind,id),UNIQUE(kind,id,project_id,workspace_id),FOREIGN KEY(kind,id) REFERENCES records(kind,id),FOREIGN KEY(workspace_id,project_id) REFERENCES workspaces(id,project_id));

CREATE TABLE item_budgets(root_id TEXT PRIMARY KEY,project_id TEXT NOT NULL,workspace_id TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,transitions INTEGER NOT NULL DEFAULT 0,automatic_tasks INTEGER NOT NULL DEFAULT 0,FOREIGN KEY(workspace_id,project_id) REFERENCES workspaces(id,project_id));

CREATE TABLE legacy_audit(seq INTEGER PRIMARY KEY,at TEXT,kind TEXT,json TEXT);

CREATE TABLE legacy_phase1(kind TEXT NOT NULL,id TEXT NOT NULL,json TEXT NOT NULL,sha256 TEXT NOT NULL,PRIMARY KEY(kind,id));

CREATE TABLE legacy_phase1_events(seq INTEGER PRIMARY KEY,at TEXT,kind TEXT,body TEXT);

CREATE TABLE legacy_records(kind TEXT NOT NULL,id TEXT NOT NULL,json TEXT NOT NULL,sha256 TEXT NOT NULL,PRIMARY KEY(kind,id));

CREATE TABLE messages(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,workspace_id TEXT NOT NULL,case_id TEXT,author TEXT NOT NULL,recipients TEXT NOT NULL,body TEXT NOT NULL,kind TEXT NOT NULL,reply_to TEXT,origin_id TEXT,forwarded_by TEXT,forward_reason TEXT,cross_project INTEGER NOT NULL DEFAULT 0,source_json TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(id,project_id,workspace_id),FOREIGN KEY(workspace_id,project_id) REFERENCES workspaces(id,project_id),FOREIGN KEY(reply_to,project_id,workspace_id) REFERENCES messages(id,project_id,workspace_id),FOREIGN KEY(origin_id) REFERENCES messages(id));

CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);

CREATE TABLE native_sessions(id TEXT PRIMARY KEY,agent_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('simulated','legacy_real')),external_id TEXT NOT NULL,title TEXT NOT NULL,UNIQUE(agent_id,external_id),UNIQUE(id,agent_id),FOREIGN KEY(agent_id) REFERENCES agents(id));

CREATE TABLE participants(project_id TEXT NOT NULL,workspace_id TEXT NOT NULL,agent_id TEXT NOT NULL,PRIMARY KEY(workspace_id,agent_id),UNIQUE(workspace_id,project_id,agent_id),FOREIGN KEY(workspace_id,project_id) REFERENCES workspaces(id,project_id),FOREIGN KEY(agent_id) REFERENCES agents(id));

CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);

CREATE TABLE records(kind TEXT,id TEXT,json TEXT NOT NULL,PRIMARY KEY(kind,id));

CREATE TABLE snapshots(item_kind TEXT NOT NULL DEFAULT 'case' CHECK(item_kind='case'),item_id TEXT NOT NULL,project_id TEXT NOT NULL,workspace_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,sha256 TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(item_id,revision),FOREIGN KEY(item_kind,item_id,project_id,workspace_id) REFERENCES entity_scope(kind,id,project_id,workspace_id));

CREATE TABLE workspaces(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,name TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,paused INTEGER NOT NULL DEFAULT 1,recipients TEXT NOT NULL DEFAULT '[]',discussion INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,UNIQUE(id,project_id),FOREIGN KEY(project_id) REFERENCES projects(id));

CREATE TRIGGER authorization_snapshot_fk BEFORE INSERT ON authorizations WHEN NOT EXISTS(SELECT 1 FROM snapshots WHERE item_id=NEW.item_id AND revision=NEW.revision AND sha256=NEW.snapshot_hash) BEGIN SELECT RAISE(ABORT,'authorization_snapshot_required'); END;

CREATE TRIGGER legacy_immutable_delete BEFORE DELETE ON legacy_records BEGIN SELECT RAISE(ABORT,'immutable_legacy'); END;

CREATE TRIGGER legacy_immutable_update BEFORE UPDATE ON legacy_records BEGIN SELECT RAISE(ABORT,'immutable_legacy'); END;

CREATE TRIGGER original_message_immutable BEFORE UPDATE ON messages BEGIN SELECT RAISE(ABORT,'immutable_message_create_forward_instead'); END;

CREATE TRIGGER scope_immutable BEFORE UPDATE ON entity_scope BEGIN SELECT RAISE(ABORT,'immutable_entity_scope'); END;

CREATE TRIGGER snapshot_immutable_delete BEFORE DELETE ON snapshots BEGIN SELECT RAISE(ABORT,'immutable_snapshot'); END;

CREATE TRIGGER snapshot_immutable_update BEFORE UPDATE ON snapshots BEGIN SELECT RAISE(ABORT,'immutable_snapshot'); END;
```
