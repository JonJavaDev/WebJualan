-- MySQL/MariaDB Schema for WebJualan
CREATE DATABASE IF NOT EXISTS webjualan;
USE webjualan;

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(12) NOT NULL UNIQUE,
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
  item_id VARCHAR(50) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  price INT NOT NULL,
  quantity INT NOT NULL,
  items_json LONGTEXT,
  payment_method VARCHAR(10) NOT NULL,
  total INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS UQ_orders_public_id ON orders(public_id);
CREATE UNIQUE INDEX IF NOT EXISTS UQ_orders_queue_code ON orders(queue_code);
CREATE UNIQUE INDEX IF NOT EXISTS UQ_preorders_public_id ON preorders(public_id);
