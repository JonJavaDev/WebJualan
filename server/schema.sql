IF DB_ID('webjualan') IS NULL
  CREATE DATABASE webjualan;
GO

USE webjualan;
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='orders' AND xtype='U')
  CREATE TABLE orders (
  id INT IDENTITY(1,1) PRIMARY KEY,
  public_id NVARCHAR(12) NOT NULL,
  name NVARCHAR(100) NOT NULL,
  class_name NVARCHAR(50) NOT NULL CONSTRAINT DF_orders_class_name DEFAULT(''),
  item_id NVARCHAR(50) NOT NULL,
  item_name NVARCHAR(100) NOT NULL,
  price INT NOT NULL,
  quantity INT NOT NULL,
  payment_method NVARCHAR(10) NOT NULL,
  total INT NOT NULL,
  status NVARCHAR(20) NOT NULL,
  queue_number INT NULL,
  queue_code NVARCHAR(8) NOT NULL,
  queue_status NVARCHAR(20) NOT NULL CONSTRAINT DF_orders_queue_status DEFAULT('waiting'),
  is_preorder BIT NOT NULL CONSTRAINT DF_orders_is_preorder DEFAULT(0),
  created_at DATETIME2 DEFAULT SYSUTCDATETIME()
  );

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='preorders' AND xtype='U')
  CREATE TABLE preorders (
  id INT IDENTITY(1,1) PRIMARY KEY,
  public_id NVARCHAR(12) NOT NULL,
  name NVARCHAR(100) NOT NULL,
  class_name NVARCHAR(50) NOT NULL CONSTRAINT DF_preorders_class_name DEFAULT(''),
  item_id NVARCHAR(50) NOT NULL,
  item_name NVARCHAR(100) NOT NULL,
  price INT NOT NULL,
  quantity INT NOT NULL,
  payment_method NVARCHAR(10) NOT NULL,
  total INT NOT NULL,
  status NVARCHAR(20) NOT NULL CONSTRAINT DF_preorders_status DEFAULT('pending'),
  created_at DATETIME2 DEFAULT SYSUTCDATETIME()
  );

IF COL_LENGTH('orders', 'queue_number') IS NULL
  ALTER TABLE orders ADD queue_number INT NULL;

IF COL_LENGTH('orders', 'queue_status') IS NULL
  ALTER TABLE orders ADD queue_status NVARCHAR(20) NOT NULL CONSTRAINT DF_orders_queue_status DEFAULT('waiting');

IF COL_LENGTH('orders', 'is_preorder') IS NULL
  ALTER TABLE orders ADD is_preorder BIT NOT NULL CONSTRAINT DF_orders_is_preorder DEFAULT(0);

IF COL_LENGTH('orders', 'class_name') IS NULL
  ALTER TABLE orders ADD class_name NVARCHAR(50) NOT NULL CONSTRAINT DF_orders_class_name DEFAULT('');

IF COL_LENGTH('orders', 'public_id') IS NULL
  ALTER TABLE orders ADD public_id NVARCHAR(12) NULL;

IF COL_LENGTH('orders', 'queue_code') IS NULL
  ALTER TABLE orders ADD queue_code NVARCHAR(8) NULL;

IF COL_LENGTH('preorders', 'status') IS NULL
  ALTER TABLE preorders ADD status NVARCHAR(20) NOT NULL CONSTRAINT DF_preorders_status DEFAULT('pending');

IF COL_LENGTH('preorders', 'class_name') IS NULL
  ALTER TABLE preorders ADD class_name NVARCHAR(50) NOT NULL CONSTRAINT DF_preorders_class_name DEFAULT('');

IF COL_LENGTH('preorders', 'public_id') IS NULL
  ALTER TABLE preorders ADD public_id NVARCHAR(12) NULL;

UPDATE orders SET queue_status = 'waiting' WHERE queue_status IS NULL;

SET LOCK_TIMEOUT 5000;

UPDATE orders
SET public_id = UPPER(LEFT(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 12))
WHERE public_id IS NULL;

UPDATE orders
SET queue_code = UPPER(LEFT(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 8))
WHERE queue_code IS NULL;

UPDATE preorders
SET public_id = UPPER(LEFT(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 12))
WHERE public_id IS NULL;

SET LOCK_TIMEOUT -1;

ALTER TABLE orders ALTER COLUMN public_id NVARCHAR(12) NOT NULL;
ALTER TABLE orders ALTER COLUMN queue_code NVARCHAR(8) NOT NULL;
ALTER TABLE preorders ALTER COLUMN public_id NVARCHAR(12) NOT NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'UQ_orders_public_id' AND object_id = OBJECT_ID('orders')
)
  CREATE UNIQUE INDEX UQ_orders_public_id ON orders(public_id);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'UQ_orders_queue_code' AND object_id = OBJECT_ID('orders')
)
  CREATE UNIQUE INDEX UQ_orders_queue_code ON orders(queue_code);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'UQ_preorders_public_id' AND object_id = OBJECT_ID('preorders')
)
  CREATE UNIQUE INDEX UQ_preorders_public_id ON preorders(public_id);
