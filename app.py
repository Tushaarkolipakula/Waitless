from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore as admin_firestore 

import os
import time
import json
from datetime import datetime, timedelta

app = Flask(__name__)
app.secret_key = 'supersecretkey'

# ---------------- Firebase Initialization ----------------
cred_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
if cred_json:
    cred_dict = json.loads(cred_json)
    cred = credentials.Certificate(cred_dict)
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(cred)
else:
    raise RuntimeError("Firebase credentials not found in environment variable")

db = admin_firestore.client()

MENU_ITEMS_DATA = [
    {
        "id": "classic_burger",
        "name": "Classic Burger",
        "category": "Burgers",
        "price": 5000, 
        "image_url": "https://imgs.search.brave.com/wYwBU7YKOdVu2o92hFfdYdkE2Y9kodSZBJiwcZXG2jI/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly90aHVt/YnMuZHJlYW1zdGlt/ZS5jb20vYi9ob21l/LWJpZy1jbGFzc2lj/LWJ1cmdlci13b29k/ZW4tdGFibGUtY2xv/c2UtdXAtMTIwNjYy/MTI2LmpwZw",
        "preparation_time": 8,
    },
    {
        "id": "cheese_burger",
        "name": "Cheese Burger",
        "category": "Burgers",
        "price": 6500,
        "image_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=1200&auto=format&fit=crop",
        "preparation_time": 10,
    },
    {
        "id": "chicken_sandwich",
        "name": "Chicken Sandwich",
        "category": "Burgers",
        "price": 4500,
        "image_url": "https://imgs.search.brave.com/3teZfF3qC5RTgllfjeLcwORDtHWbi9IHI4ynfX9MCmQ/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly93d3cu/YWxscmVjaXBlcy5j/b20vdGhtYi9zdmNh/bFVjU0k3UlVlWDBy/bkh2bmtXZTZQcW89/LzI4MngxODgvZmls/dGVyczpub191cHNj/YWxlKCk6bWF4X2J5/dGVzKDE1MDAwMCk6/c3RyaXBfaWNjKCkv/ODk4ODc2OS1uYXNo/dmlsbGUtaG90LWNo/aWNrZW4tYW5kLXdh/ZmZsZS1zYW5kd2lj/aC1BbGxyZWNpcGVz/UGhvdG8tMXgxLTEt/YWQ1ODBiZjBjODYy/NDM3YTk5NDA1Njg3/OTI0MzBlZDAuanBn",
        "preparation_time": 9,
    },
    {
        "id": "french_fries",
        "name": "French Fries",
        "category": "Sides",
        "price": 3500,
        "image_url": "https://imgs.search.brave.com/DkkESzIw1-7SICzI0ugM9uoQwr4_dbd_2LiGF48baxY/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly93d3cu/Zm9vZHJlcHVibGlj/LmNvbS9pbWcvZ2Fs/bGVyeS8zMC1kaWZm/ZXJlbnQtdHlwZXMt/b2YtZnJlbmNoLWZy/aWVzLWV4cGxhaW5l/ZC11cGdyYWRlL3Ry/YWRpdGlvbmFsLWN1/dC1mcmllcy0xNzQ3/NDM0NjEwLmpwZw",
        "preparation_time": 4,
    },
    {
        "id": "onion_rings",
        "name": "Onion Rings",
        "category": "Sides",
        "price": 4000,
        "image_url": "https://imgs.search.brave.com/bMyvKXsEH32MRM9S0rJdg-SDqcIOnJWbTYR5xhMI1yY/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9zdGF0/aWMudmVjdGVlenku/Y29tL3N5c3RlbS9y/ZXNvdXJjZXMvdGh1/bWJuYWlscy8wNDQv/NjQ4Lzg4Mi9zbWFs/bC9jcmlzcHktb25p/b24tcmluZ3MtYmF0/dGVyZWQtYW5kLWZy/aWVkLXRvLXBlcmZl/Y3Rpb24tYWRkLWEt/dGFzdHktY3J1bmNo/LXRvLXRoZS10YWJs/ZS1vZi13ZXN0ZXJu/LWRlbGlnaHRzLXBo/b3RvLmpwZw",
        "preparation_time": 5,
    },
    {
        "id": "coca_cola",
        "name": "Coca Cola",
        "category": "Drinks",
        "price": 2000,
        "image_url": "https://imgs.search.brave.com/p9ZfElOLAMZJHjGqYs9DUY0k1DOinCOeJzHCWMCr6ss/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9tZWRp/YS5nZXR0eWltYWdl/cy5jb20vaWQvNDU4/NjEzOTMzL3Bob3Rv/L2Nhbi1vZi1jb2tl/LmpwZz9zPTYxMng2/MTImdz0wJms9MjAm/Yz0weldKeUhsbmRz/UE9ZNFA0MThkS04z/YW1vZHRZR1JKNU93/aTVTR1hIQ1VFPQ",
        "preparation_time": 2,
    },
    {
        "id": "sprite",
        "name": "Sprite",
        "category": "Drinks",
        "price": 2000,
        "image_url": "https://imgs.search.brave.com/PVo1sOrw7jr1jeY6XU7OMyF8gZrmWYDoyl3yGTuYuKQ/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly90NC5m/dGNkbi5uZXQvanBn/LzE0LzE2LzgxLzUz/LzM2MF9GXzE0MTY4/MTUzNjVfbjYyUTFI/cEdxMVhwd0V1ckhn/RHlxaHpxdzFGZFRm/VUcuanBn",
        "preparation_time": 2,
    },
    {
        "id": "milkshake",
        "name": "Milkshake",
        "category": "Drinks",
        "price": 3500,
        "image_url": "https://imgs.search.brave.com/jVhs5FGhoCuJt0jauMyHN3Vckk8xwltKIx5VHql-eaI/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9zdGF0/aWMudmVjdGVlenku/Y29tL3N5c3RlbS9y/ZXNvdXJjZXMvdGh1/bWJuYWlscy8wMjIv/MjU1LzU2OS9zbWFs/bC9taWxrc2hha2Ut/d2l0aC13aGlwcGVk/LWNyZWFtLWFuZC1j/dXBjYWtlLTNkLXJl/bmRlcmluZy1nZW5l/cmF0aXZlLWFpLWZy/ZWUtcGhvdG8uanBn",
        "preparation_time": 3,
    },
    {
        "id": "special1",
        "name": "Spicy Ramen Bowl",
        "price": 10000,
        "category": "Specials",
        "image_url": "https://imgs.search.brave.com/JzKc2RA75dmr1euQOFm4zvNdE2D-Cu-PKh2UYaH4IOE/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly90My5m/dGNkbi5uZXQvanBn/LzEyLzEyLzYxLzUy/LzM2MF9GXzEyMTI2/MTUyMzhfeEFidURX/YUJWWGFWelFQNmtl/V2dCUlBGbFF0OFV2/T1EuanBn",
        "preparation_time": 20
    },
    {
        "id": "special2",
        "name": "Avocado Smash Toast",
        "price": 18000,
        "category": "Specials",
        "image_url": "https://imgs.search.brave.com/pazm3A3sZpfd_r1IKM6z__J-s5H2DXcCJxmlCh78W6s/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tYWxs/b3J5dGhlZGlldGl0/aWFuLmNvbS93cC1j/b250ZW50L3VwbG9h/ZHMvMjAyNC8wNS9z/bWFzaGVkLWF2b2Nh/ZG8tdG9hc3Qtd2l0/aC1lZ2ctYW5kLXJl/ZC1wZXBwZXItZmxh/a2VzLTMwMHgzMDAu/anBn",
        "preparation_time": 10
    },
    {
        "id": "special3",
        "name": "Berry Blast Smoothie",
        "price": 6000,
        "category": "Drinks",
        "image_url": "https://imgs.search.brave.com/2vyD5-W3L9ePQjiN2Kgi7X-F8YfYkH16zI2LovBWP-Q/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9pLnBp/bmltZy5jb20vb3Jp/Z2luYWxzLzRhLzRj/L2E0LzRhNGNhNGQy/M2E3ODhjZDhjZTZl/NGQ4MzNjZmZkMmFm/LmpwZw",
        "preparation_time": 5
    },
    {
        "id": "special4",
        "name": "Chicken Caesar Salad",
        "price": 8000,
        "category": "Sides",
        "image_url": "https://imgs.search.brave.com/7vh2inPA9KNoitwQfhzQ3uQz-P1ZoGI3rBufgzliCvU/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly91cy4x/MjNyZi5jb20vNDUw/d20vYW50YWxleHN0/dWRpby9hbnRhbGV4/c3R1ZGlvMjMwNi9h/bnRhbGV4c3R1ZGlv/MjMwNjAwODU5LzIw/Njk5NzM5My1jYWVz/YXItc2FsYWQtd2l0/aC1jaGlja2VuLW9u/LWdyZWVuLWJhY2tn/cm91bmQuanBnP3Zl/cj02",
        "preparation_time": 12
    },
]


# --- Helper to get menu item details by ID ---
def get_menu_item(item_id):
    for item in MENU_ITEMS_DATA:
        if item["id"] == item_id:
            return item
    return None

# Helper to get user ID from session
def get_user_id():
    """Retrieves the user ID from the session. Returns None if not logged in."""
    email = session.get('email')
    if email:
        # For simplicity, using email as user ID. In a real app, you'd use Firebase Auth UID.
        return email.replace('.', '_').replace('@', '_')
    print("get_user_id: User not logged in, returning None.")
    return None

# Helper to get user data from email
def get_user_data_by_email(email):
    users_ref = db.collection('users')
    docs = users_ref.where('email', '==', email).limit(1).get()
    if docs:
        return docs[0].to_dict()
    return None


# ========== ROUTES ==========

@app.route('/')
def home():
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        confirm_password = request.form['confirm_password']
        username = request.form['username']

        if password != confirm_password:
            return "Passwords do not match"

        user_ref = db.collection('users')
        existing_user_query = user_ref.where('email', '==', email).limit(1).get()
        if len(existing_user_query) > 0:
            return "User already exists"

        user_ref.add({
            'email': email,
            'password': password,  # NOTE: hash in production!
            'username': username
        })

        session['email'] = email
        print(f"User {email} registered and logged in as regular user.")
        return redirect(url_for('dashboard'))

    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        users_ref = db.collection('users')
        docs = users_ref.where('email', '==', email).where('password', '==', password).limit(1).get()

        if docs:
            session['email'] = email
            print(f"User {email} logged in.")
            return redirect(url_for('dashboard'))
        else:
            print(f"Login failed for {email}.")
            return render_template('login.html', error="Invalid credentials")

    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('email', None)
    print("User logged out.")
    return redirect(url_for('login'))

@app.route('/dashboard')
def dashboard():
    email = session.get('email', '')
    user_data = get_user_data_by_email(email)
    username = user_data.get('username', email.split('@')[0]) if user_data else 'User'
    return render_template('student_dashboard.html', email=email, username=username, active_page='dashboard')

@app.route('/menu')
def menu():
    return render_template('menu.html', active_page='menu')

@app.route('/load-menu')
def load_menu_partial():
    return render_template('menu_partial.html', menu_items=MENU_ITEMS_DATA)

@app.route('/load-home')
def load_home():
    email = session.get('email', '')
    user_data = get_user_data_by_email(email)
    username = user_data.get('username', email.split('@')[0]) if user_data else 'User'
    return render_template('home_partial.html', email=email, username=username)

@app.route('/load-cart')
def load_cart():
    return render_template('cart_partial.html')

@app.route('/cart')
def cart():
    return render_template('cart.html', active_page='cart')

# --- API Endpoints ---

@app.route('/api/cart/add', methods=['POST'])
def add_to_cart():
    user_id = get_user_id()
    if not user_id:
        print("add_to_cart: User not logged in, returning 401.")
        return jsonify(success=False, message="Unauthorized"), 401

    data = request.get_json()
    item_id = data.get('item_id')
    quantity = data.get('quantity', 1)

    if not item_id:
        print("add_to_cart: Missing item_id.")
        return jsonify(success=False, message="Item ID is required"), 400

    item_details = get_menu_item(item_id)
    if not item_details:
        print(f"add_to_cart: Item with ID '{item_id}' not found in MENU_ITEMS_DATA.")
        return jsonify(success=False, message="Item not found"), 404

    item_name = item_details['name']
    item_price = item_details['price']
    item_image_url = item_details['image_url']
    item_prep_time_from_menu = item_details['preparation_time']

    user_cart_ref = db.collection('carts').document(user_id)
    cart_doc = user_cart_ref.get()
    cart_items = {}
    if cart_doc.exists:
        cart_data = cart_doc.to_dict()
        cart_items = cart_data.get('items', {})
        print(f"add_to_cart: Existing cart for {user_id}: {cart_items}")

    if item_id in cart_items:
        cart_items[item_id]['quantity'] += quantity
        print(f"add_to_cart: Updated quantity for {item_id} to {cart_items[item_id]['quantity']}.")
    else:
        cart_items[item_id] = {
            'name': item_name,
            'price': item_price,
            'quantity': quantity,
            'image_url': item_image_url,
            'preparation_time': item_prep_time_from_menu
        }
        print(f"add_to_cart: Added new item {item_id} with quantity {quantity}.")

    user_cart_ref.set({'items': cart_items})
    return jsonify(success=True, message="Item added to cart", cart_items=cart_items), 200

@app.route('/api/cart/update_quantity', methods=['POST'])
def update_cart_quantity():
    user_id = get_user_id()
    if not user_id:
        print("update_cart_quantity: User not logged in, returning 401.")
        return jsonify(success=False, message="Unauthorized"), 401

    data = request.get_json()
    item_id = data.get('item_id')
    quantity = data.get('quantity')

    if not item_id or quantity is None:
        print("update_cart_quantity: Missing item_id or quantity.")
        return jsonify(success=False, message="Item ID and quantity are required"), 400
    if not isinstance(quantity, int) or quantity < 0:
        print(f"update_cart_quantity: Invalid quantity type or value: {quantity}")
        return jsonify(success=False, message="Quantity must be a non-negative integer"), 400

    user_cart_ref = db.collection('carts').document(user_id)
    cart_doc = user_cart_ref.get()
    if not cart_doc.exists:
        print(f"update_cart_quantity: Cart for user {user_id} not found.")
        return jsonify(success=False, message="Cart not found"), 404

    cart_data = cart_doc.to_dict()
    cart_items = cart_data.get('items', {})

    if item_id not in cart_items:
        print(f"update_cart_quantity: Item {item_id} not in cart.")
        return jsonify(success=False, message="Item not in cart"), 404

    if quantity <= 0:
        del cart_items[item_id]
        print(f"update_cart_quantity: Removed item {item_id} from cart.")
    else:
        cart_items[item_id]['quantity'] = quantity
        print(f"update_cart_quantity: Updated item {item_id} quantity to {quantity}.")

    user_cart_ref.set({'items': cart_items})
    return jsonify(success=True, message="Cart updated", cart_items=cart_items), 200

@app.route('/api/cart/remove', methods=['POST'])
def remove_from_cart():
    user_id = get_user_id()
    if not user_id:
        print("remove_from_from_cart: User not logged in, returning 401.")
        return jsonify(success=False, message="Unauthorized"), 401

    data = request.get_json()
    item_id = data.get('item_id')

    if not item_id:
        print("remove_from_from_cart: Missing item_id.")
        return jsonify(success=False, message="Item ID is required"), 400

    user_cart_ref = db.collection('carts').document(user_id)
    cart_doc = user_cart_ref.get()
    if not cart_doc.exists:
        print(f"remove_from_cart: Cart for user {user_id} not found.")
        return jsonify(success=False, message="Cart not found"), 404

    cart_data = cart_doc.to_dict()
    cart_items = cart_data.get('items', {})

    if item_id in cart_items:
        del cart_items[item_id]
        print(f"remove_from_cart: Item {item_id} removed from cart.")
        user_cart_ref.set({'items': cart_items})
        return jsonify(success=True, message="Item removed from cart", cart_items=cart_items), 200
    else:
        print(f"remove_from_cart: Item {item_id} not found in cart.")
        return jsonify(success=False, message="Item not in cart"), 404

@app.route('/api/cart', methods=['GET'])
def get_cart():
    user_id = get_user_id()
    if not user_id:
        print("get_cart: User not logged in, returning 401.")
        return jsonify(success=False, message="Unauthorized"), 401

    user_cart_ref = db.collection('carts').document(user_id)
    cart_doc = user_cart_ref.get()
    if cart_doc.exists:
        cart_data = cart_doc.to_dict()
        items = cart_data.get('items', {})
        cart_list = []
        total_price = 0
        for item_id, details in items.items():
            price_cents = details.get('price', 0)
            quantity = details.get('quantity', 0)

            cart_list.append({
                'id': item_id,
                'name': details.get('name', 'Unknown Item'),
                'price': price_cents,  # cents
                'quantity': quantity,
                'image_url': details.get('image_url', ''),
                'preparation_time': details.get('preparation_time', 5)
            })
            total_price += (price_cents * quantity)
        print(f"get_cart: Retrieved cart for {user_id}: {cart_list}, total price: {total_price}")
        return jsonify(success=True, cart_items=cart_list, total_price=total_price), 200
    print(f"get_cart: No cart found for user {user_id}.")
    return jsonify(success=True, cart_items=[], total_price=0), 200

# --- Place Order Route ---
@app.route('/api/place_order', methods=['POST'])
def place_order():
    user_id = get_user_id()
    if not user_id:
        return jsonify(success=False, message="Unauthorized"), 401

    data = request.get_json()
    cart_items = data.get('cart_items', [])
    if not cart_items:
        return jsonify(success=False, message="Cart is empty"), 400

    total_preparation_time = sum(item.get('preparation_time', 5) for item in cart_items)
    total_price = sum(item.get('price', 0) * item.get('quantity', 1) for item in cart_items)

    order_ref = db.collection('orders').document()
    order_ref.set({
        "user_id": user_id,
        "items": cart_items,
        "total_price": total_price,
        "total_preparation_time": total_preparation_time,
        "status": "pending",
        "order_time": int(time.time()),
        "estimated_completion_time": int(time.time()) + total_preparation_time * 60
    })

    # Clear cart
    db.collection('carts').document(user_id).set({"items": {}})

    return jsonify(success=True, message="Order placed successfully", order_id=order_ref.id), 200



@app.route('/api/dashboard_data')
def dashboard_data():
    user_id = get_user_id()
    if not user_id:
        return jsonify(success=False, message="Unauthorized"), 401

    orders_ref = db.collection('orders')
    orders = orders_ref.stream()

    total_orders_count = 0
    pending_orders_count = 0
    preparing_orders_count = 0
    completed_orders_count = 0
    user_latest_order = None
    people_ahead = 0
    estimated_user_wait_time = 0

    now = int(time.time())  # current time in seconds

    for order_doc in orders:
        order = order_doc.to_dict()
        total_orders_count += 1

        # --- Auto update statuses ---
        est_completion = order.get("estimated_completion_time")
        order_id = order_doc.id
        current_status = order.get("status", "pending")

        if est_completion:
            if now >= est_completion and current_status != "completed":
                # mark completed if time has passed
                db.collection("orders").document(order_id).update({"status": "completed"})
                current_status = "completed"
            elif now < est_completion and current_status == "pending":
                # move to preparing once it's started
                db.collection("orders").document(order_id).update({"status": "preparing"})
                current_status = "preparing"

        # Count by status
        if current_status == "pending":
            pending_orders_count += 1
        elif current_status == "preparing":
            preparing_orders_count += 1
        elif current_status == "completed":
            completed_orders_count += 1

        # Track user's latest order
        if order.get("user_id") == user_id:
            if not user_latest_order or order["order_time"] > user_latest_order["order_time"]:
                user_latest_order = order
                user_latest_order["status"] = current_status  # include updated status

    return jsonify({
        "total_orders_count": total_orders_count,
        "pending_orders_count": pending_orders_count,
        "preparing_orders_count": preparing_orders_count,
        "completed_orders_count": completed_orders_count,
        "people_ahead": people_ahead,
        "estimated_user_wait_time": estimated_user_wait_time,
        "user_latest_order": user_latest_order
    })


@app.route('/api/dashboard_data', methods=['GET'])
def get_dashboard_data():
    user_id = get_user_id()
    if not user_id:
        print("get_dashboard_data: User not logged in, returning 401.")
        return jsonify(success=False, message="Unauthorized"), 401

    orders_ref = db.collection('orders')

    all_user_orders = orders_ref.where('user_id', '==', user_id).get()
    total_orders_count = len(all_user_orders)

    pending_orders_query = orders_ref.where('user_id', '==', user_id).where('status', '==', 'pending')
    pending_orders = pending_orders_query.get()
    pending_orders_count = len(pending_orders)

    preparing_orders_query = orders_ref.where('user_id', '==', user_id).where('status', '==', 'preparing')
    preparing_orders = preparing_orders_query.get()
    preparing_orders_count = len(preparing_orders)

    completed_orders_query = orders_ref.where('user_id', '==', user_id).where('status', '==', 'completed')
    completed_orders = completed_orders_query.get()
    completed_orders_count = len(completed_orders)

    user_latest_order = None

    # Order by order_time desc and limit 1 for active orders (requires composite index)
    active_user_orders_query = orders_ref.where('user_id', '==', user_id).where('status', 'in', ['pending', 'preparing']).order_by('order_time', direction=admin_firestore.Query.DESCENDING).limit(1)
    active_user_orders_docs = active_user_orders_query.get()

    if active_user_orders_docs:
        user_latest_order = active_user_orders_docs[0].to_dict()
        user_latest_order['id'] = active_user_orders_docs[0].id

        # Normalize timestamps to epoch seconds
        ot = user_latest_order.get('order_time')
        ect = user_latest_order.get('estimated_completion_time')
        if isinstance(ot, datetime):
            user_latest_order['order_time'] = int(ot.timestamp())
        elif isinstance(ot, (int, float)):
            user_latest_order['order_time'] = int(ot)
        if isinstance(ect, datetime):
            user_latest_order['estimated_completion_time'] = int(ect.timestamp())
        elif isinstance(ect, (int, float)):
            user_latest_order['estimated_completion_time'] = int(ect)

        print(f"get_dashboard_data: Latest active order for {user_id}: {user_latest_order}")
    else:
        latest_completed_order_query = orders_ref.where('user_id', '==', user_id).where('status', '==', 'completed').order_by('order_time', direction=admin_firestore.Query.DESCENDING).limit(1)
        latest_completed_order_docs = latest_completed_order_query.get()
        if latest_completed_order_docs:
            user_latest_order = latest_completed_order_docs[0].to_dict()
            user_latest_order['id'] = latest_completed_order_docs[0].id

            ot = user_latest_order.get('order_time')
            ect = user_latest_order.get('estimated_completion_time')
            if isinstance(ot, datetime):
                user_latest_order['order_time'] = int(ot.timestamp())
            elif isinstance(ot, (int, float)):
                user_latest_order['order_time'] = int(ot)
            if isinstance(ect, datetime):
                user_latest_order['estimated_completion_time'] = int(ect.timestamp())
            elif isinstance(ect, (int, float)):
                user_latest_order['estimated_completion_time'] = int(ect)
            print(f"get_dashboard_data: Latest completed order for {user_id}: {user_latest_order}")
        else:
            print("get_dashboard_data: No active or completed order found for the user.")

    people_ahead = 0
    estimated_user_wait_time = 0

    if user_latest_order and user_latest_order.get('status') in ['pending', 'preparing']:
        all_active_orders_in_system_query = orders_ref.where('status', 'in', ['pending', 'preparing'])
        all_active_orders_in_system = all_active_orders_in_system_query.get()

        current_time = int(time.time())

        total_prep_time_ahead = 0
        for order_doc in all_active_orders_in_system:
            order_data = order_doc.to_dict()
            if order_data.get('order_time', 0) < user_latest_order.get('order_time', 0):
                people_ahead += 1
                total_prep_time_ahead += order_data.get('total_preparation_time', 0)

        if user_latest_order.get('estimated_completion_time') is not None:
            remaining_seconds_for_user_order = max(0, user_latest_order['estimated_completion_time'] - current_time)
            estimated_user_wait_time = (total_prep_time_ahead * 60 + remaining_seconds_for_user_order) // 60
        else:
            estimated_user_wait_time = 0

    print(f"Dashboard data: Total: {total_orders_count}, Pending: {pending_orders_count}, Preparing: {preparing_orders_count}, Completed: {completed_orders_count}, People Ahead: {people_ahead}, Est Wait: {estimated_user_wait_time}")

    return jsonify(
        success=True,
        total_orders_count=total_orders_count,
        pending_orders_count=pending_orders_count,
        preparing_orders_count=preparing_orders_count,
        completed_orders_count=completed_orders_count,
        people_ahead=people_ahead,
        estimated_user_wait_time=estimated_user_wait_time,
        user_latest_order=user_latest_order
    ), 200

# --- API Endpoint to simulate order completion (for testing purposes) ---
@app.route('/api/complete_order/<order_id>,', methods=['POST'])
def complete_order(order_id):
    """Simulates completing an order. This would typically be an admin action."""
    user_id = get_user_id()
    if not user_id:
        print("complete_order: User not logged in, returning 401.")
        return jsonify(success=False, message="Unauthorized"), 401

    order_ref = db.collection('orders').document(order_id)
    order_doc = order_ref.get()

    if not order_doc.exists:
        print(f"complete_order: Order {order_id} not found.")
        return jsonify(success=False, message="Order not found"), 404

    order_data = order_doc.to_dict()

    if order_data.get('status') == 'completed':
        print(f"complete_order: Order {order_id} is already completed.")
        return jsonify(success=False, message="Order is already completed"), 400

    try:
        order_ref.update({'status': 'completed', 'completion_time': int(time.time())})
        print(f"complete_order: Order {order_id} marked as completed.")
        return jsonify(success=True, message=f"Order {order_id} completed."), 200
    except Exception as e:
        print(f"Error completing order {order_id}: {e}")
        return jsonify(success=False, message="Failed to complete order", error=str(e)), 500

if __name__ == '__main__':
    # In development only; set debug=False in production
    app.run(debug=True)
