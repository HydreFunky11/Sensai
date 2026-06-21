import sqlite3

def migrate():
    conn = sqlite3.connect('sensai.db')
    cursor = conn.cursor()
    
    columns_to_add = [
        ("stripe_customer_id", "VARCHAR"),
        ("is_premium", "BOOLEAN DEFAULT 0"),
        ("subscription_id", "VARCHAR"),
        ("subscription_end_at", "DATETIME")
    ]
    
    for col_name, col_type in columns_to_add:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
            print(f"Added column {col_name} to users table.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"Column {col_name} already exists.")
            else:
                print(f"Error adding column {col_name}: {e}")
                
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
