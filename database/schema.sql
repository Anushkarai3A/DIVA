-- Generated from backend/app/models (keep in sync: recreate DB after model changes)

CREATE TABLE IF NOT EXISTS deviations (
	id UUID NOT NULL, 
	deviation_number VARCHAR(50) NOT NULL, 
	title TEXT NOT NULL, 
	description TEXT, 
	event_date TIMESTAMP WITHOUT TIME ZONE, 
	reported_date TIMESTAMP WITHOUT TIME ZONE, 
	department VARCHAR(150), 
	site VARCHAR(150), 
	product_name VARCHAR(255), 
	product_code VARCHAR(100), 
	batch_number VARCHAR(100), 
	manufacturing_stage VARCHAR(255), 
	process_parameter VARCHAR(255), 
	approved_range VARCHAR(255), 
	actual_value VARCHAR(100), 
	unit VARCHAR(50), 
	duration VARCHAR(100), 
	equipment VARCHAR(255), 
	equipment_id VARCHAR(100), 
	immediate_action TEXT, 
	potential_impact TEXT, 
	root_cause_indication TEXT, 
	ai_recommended_severity VARCHAR(50), 
	final_severity VARCHAR(50) NOT NULL, 
	ai_impact_level VARCHAR(50), 
	ai_reason TEXT, 
	status VARCHAR(50) NOT NULL, 
	source_type VARCHAR(20), 
	ai_confidence_avg FLOAT, 
	created_by VARCHAR(100) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS ai_assessments (
	id UUID NOT NULL, 
	deviation_id UUID NOT NULL, 
	provider VARCHAR(20) NOT NULL, 
	model VARCHAR(100) NOT NULL, 
	extraction JSONB, 
	confidence JSONB, 
	evidence JSONB, 
	validation JSONB, 
	impact JSONB, 
	severity JSONB, 
	explanation TEXT, 
	raw_text_excerpt TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(deviation_id) REFERENCES deviations (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_events (
	id UUID NOT NULL, 
	deviation_id UUID NOT NULL, 
	event_type VARCHAR(50) NOT NULL, 
	actor VARCHAR(100) NOT NULL, 
	details JSONB, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(deviation_id) REFERENCES deviations (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_deviations_final_severity ON deviations (final_severity);
CREATE INDEX IF NOT EXISTS ix_deviations_status ON deviations (status);
CREATE INDEX IF NOT EXISTS ix_deviations_batch_number ON deviations (batch_number);
CREATE INDEX IF NOT EXISTS ix_deviations_ai_recommended_severity ON deviations (ai_recommended_severity);
CREATE UNIQUE INDEX ix_deviations_deviation_number ON deviations (deviation_number);
CREATE INDEX IF NOT EXISTS ix_ai_assessments_deviation_id ON ai_assessments (deviation_id);
CREATE INDEX IF NOT EXISTS ix_audit_events_deviation_id ON audit_events (deviation_id);
CREATE INDEX IF NOT EXISTS ix_audit_events_created_at ON audit_events (created_at);
