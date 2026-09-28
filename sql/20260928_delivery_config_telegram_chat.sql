ALTER TABLE delivery_config
  ADD COLUMN telegram_chat_id VARCHAR(100) NULL AFTER api_key;
