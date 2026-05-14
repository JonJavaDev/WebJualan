-- MySQL/MariaDB Schema for WebJualan
CREATE DATABASE IF NOT EXISTS webjualan;
USE webjualan;

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(12) NOT NULL UNIQUE,
  phone VARCHAR(30) DEFAULT NULL,
  name VARCHAR(100) NOT NULL,
  class_name VARCHAR(50) NOT NULL DEFAULT '',
  item_id VARCHAR(50) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  price INT NOT NULL,
  quantity INT NOT NULL,
  items_json LONGTEXT,
  payment_method VARCHAR(10) NOT NULL,
  total INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  queue_number INT NULL,
  queue_code VARCHAR(8) NOT NULL UNIQUE,
  queue_status VARCHAR(20) NOT NULL DEFAULT 'waiting',
  is_preorder TINYINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Preorders table
CREATE TABLE IF NOT EXISTS preorders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(12) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  class_name VARCHAR(50) NOT NULL DEFAULT '',
  `level` INT NOT NULL DEFAULT 0,
  note VARCHAR(255) DEFAULT NULL,
  item_id VARCHAR(50) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  price INT NOT NULL,
  quantity INT NOT NULL,
  items_json LONGTEXT,
  payment_method VARCHAR(10) NOT NULL,
  total INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  payment_proof LONGBLOB DEFAULT NULL,
  payment_proof_type VARCHAR(100) DEFAULT NULL,
  payment_proof_name VARCHAR(255) DEFAULT NULL,
  payment_proof_uploaded_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS UQ_orders_public_id ON orders(public_id);
CREATE UNIQUE INDEX IF NOT EXISTS UQ_orders_queue_code ON orders(queue_code);
CREATE UNIQUE INDEX IF NOT EXISTS UQ_preorders_public_id ON preorders(public_id);

-- For existing databases, provide ALTER statements to add new columns if they don't exist.
-- Run these on the server once (e.g. using mysql CLI) to bring the schema up-to-date:
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone VARCHAR(30) DEFAULT NULL;
-- ALTER TABLE preorders ADD COLUMN IF NOT EXISTS `level` INT NOT NULL DEFAULT 0;
-- ALTER TABLE preorders ADD COLUMN IF NOT EXISTS note VARCHAR(255) DEFAULT NULL;
-- ALTER TABLE preorders ADD COLUMN IF NOT EXISTS payment_proof LONGBLOB DEFAULT NULL;
-- ALTER TABLE preorders ADD COLUMN IF NOT EXISTS payment_proof_type VARCHAR(100) DEFAULT NULL;
-- ALTER TABLE preorders ADD COLUMN IF NOT EXISTS payment_proof_name VARCHAR(255) DEFAULT NULL;
-- ALTER TABLE preorders ADD COLUMN IF NOT EXISTS payment_proof_uploaded_at TIMESTAMP NULL DEFAULT NULL;


