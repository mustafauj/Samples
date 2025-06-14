-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    fname VARCHAR(100) NOT NULL,
    lname VARCHAR(100) NOT NULL,
    mobile VARCHAR(20) UNIQUE,
    email VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);

-- Enable Row Level Security (RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for authenticated users
CREATE POLICY "Enable all operations for authenticated users" ON customers
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true); 