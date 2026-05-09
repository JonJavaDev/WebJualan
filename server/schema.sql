IF DB_ID('webjualan') IS NULL
  CREATE DATABASE webjualan;
GO

USE webjualan;
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='orders' AND xtype='U')
  CREATE TABLE orders (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(100) NOT NULL,
  item_id NVARCHAR(50) NOT NULL,
  item_name NVARCHAR(100) NOT NULL,
  price INT NOT NULL,
  quantity INT NOT NULL,
  payment_method NVARCHAR(10) NOT NULL,
  total INT NOT NULL,
  status NVARCHAR(20) NOT NULL,
  queue_number INT NULL,
  queue_status NVARCHAR(20) NOT NULL CONSTRAINT DF_orders_queue_status DEFAULT('waiting'),
  is_preorder BIT NOT NULL CONSTRAINT DF_orders_is_preorder DEFAULT(0),
  created_at DATETIME2 DEFAULT SYSUTCDATETIME()
  );

IF COL_LENGTH('orders', 'queue_number') IS NULL
  ALTER TABLE orders ADD queue_number INT NULL;

IF COL_LENGTH('orders', 'queue_status') IS NULL
  ALTER TABLE orders ADD queue_status NVARCHAR(20) NOT NULL CONSTRAINT DF_orders_queue_status DEFAULT('waiting');

IF COL_LENGTH('orders', 'is_preorder') IS NULL
  ALTER TABLE orders ADD is_preorder BIT NOT NULL CONSTRAINT DF_orders_is_preorder DEFAULT(0);

UPDATE orders SET queue_status = 'waiting' WHERE queue_status IS NULL;
