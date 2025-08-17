document.addEventListener("DOMContentLoaded", function () {
    const mainContentContainer = document.getElementById("main-content");
    const customConfirmModal = document.getElementById('customConfirmModal');
    const confirmYesBtn = document.getElementById('confirmYes');
    const confirmNoBtn = document.getElementById('confirmNo');
    let confirmCallback = null;

    // Store interval ID to manage it properly
    let dashboardUpdateInterval = null;

    console.log("DOM Content Loaded. Initializing app.js.");

    /**
     * Shows a custom confirmation modal.
     * @param {string} message - The message to display.
     * @param {function} onConfirm - Callback function if 'Yes' is clicked.
     */
    function showCustomConfirm(message, onConfirm) {
        if (!customConfirmModal) {
            console.error("Custom confirmation modal element not found. Please ensure customConfirmModal exists in student_dashboard.html");
            // Fallback to direct action if modal isn't available - this is for non-critical confirms
            // For logout, we still need user input, so this fallback is minimal.
            // For order confirmation, it directly proceeds.
            onConfirm(true);
            return;
        }
        customConfirmModal.querySelector('p').textContent = message;
        confirmCallback = onConfirm;
        customConfirmModal.style.display = 'flex'; // Use flex to center
        console.log("Custom confirmation modal shown.");
    }

    // Event listeners for custom confirm modal buttons
    if (confirmYesBtn) {
        confirmYesBtn.addEventListener('click', () => {
            console.log("Confirm 'Yes' clicked.");
            if (confirmCallback) {
                confirmCallback(true);
            }
            customConfirmModal.style.display = 'none';
        });
    }

    if (confirmNoBtn) {
        confirmNoBtn.addEventListener('click', () => {
            console.log("Confirm 'No' clicked.");
            if (confirmCallback) {
                confirmCallback(false);
            }
            customConfirmModal.style.display = 'none';
        });
    }

    // Intercept logout button click to use custom confirm
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("Logout button clicked.");
            showCustomConfirm("Are you sure you want to log out?", (result) => {
                if (result) {
                    console.log("Logging out...");
                    window.location.href = "/logout";
                } else {
                    console.log("Logout cancelled.");
                }
            });
        });
    }

    /**
     * Loads partial HTML content into the main content area.
     * @param {string} page - The page to load (e.g., 'home', 'menu', 'cart').
     */
    async function loadPartial(page) {
        if (!mainContentContainer) {
            console.error("Main content container not found. Cannot load partial.");
            return;
        }

        // Clear any existing user dashboard interval before loading new content
        if (dashboardUpdateInterval) {
            clearInterval(dashboardUpdateInterval);
            console.log("Cleared user dashboard interval.");
            dashboardUpdateInterval = null;
        }

        console.log(`Attempting to load partial: /load-${page}`);
        mainContentContainer.innerHTML = '<p class="text-center text-gray-500 py-8">Loading...</p>'; // Show loading message
        mainContentContainer.classList.add("opacity-0", "translate-x-2", "transition", "duration-300");

        try {
            const res = await fetch(`/load-${page}`);
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`HTTP error! status: ${res.status}, response: ${errorText}`);
            }
            const html = await res.text();

            setTimeout(() => {
                mainContentContainer.innerHTML = html;
                mainContentContainer.classList.remove("translate-x-2");
                mainContentContainer.classList.add("translate-x-0");
                mainContentContainer.classList.remove("opacity-0");
                console.log(`Partial '${page}' loaded successfully.`);

                // After content is loaded, attach specific event listeners / initialize content
                if (page === 'menu') {
                    attachMenuEventListeners();
                    checkAndConvertExistingCartItems();
                } else if (page === 'cart') {
                    attachCartEventListeners();
                } else if (page === 'home') {
                    fetchDashboardData();
                    startHomeLiveUpdater(); // Start speedometer updates
                }
                // Update active sidebar link
                document.querySelectorAll(".sidebar-item").forEach(item => {
                    if (item.dataset.page === page) {
                        item.classList.add("active");
                    } else {
                        item.classList.remove("active");
                    }
                });

            }, 200);
        } catch (error) {
            console.error(`Error loading partial for ${page}:`, error);
            mainContentContainer.innerHTML = `<p class="text-red-500 text-center py-8">Failed to load content for ${page}. Please check the console for more details.</p>`;
        }
    }

    // Initial load for the home page (when the main app.js loads)
    loadPartial('home');

    // Attach event listeners to sidebar items
    document.querySelectorAll(".sidebar-item").forEach(link => {
        link.addEventListener("click", function (e) {
            e.preventDefault();
            const page = this.dataset.page;
            if (page) {
                loadPartial(page);
            }
        });
    });

    // --- Menu Page Logic ---
    function attachMenuEventListeners() {
        console.log("Attaching menu event listeners.");

        // Attach listeners to Add to Cart buttons
        document.querySelectorAll('.add-to-cart-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const clickedButton = e.target.closest('.add-to-cart-btn');
                if (!clickedButton) {
                    console.error("Clicked element or its parent is not an add-to-cart-btn.");
                    return;
                }

                const itemId = clickedButton.dataset.itemId;
                const itemName = clickedButton.dataset.itemName;
                const itemPrepTime = parseInt(clickedButton.dataset.itemPrepTime);

                console.log(`Add to cart clicked for item: ${itemName} (ID: ${itemId})`);

                if (!itemId) {
                    console.error("Item ID is undefined or null from button dataset.");
                    return; // Stop execution if no item ID
                }

                const payload = { item_id: itemId, quantity: 1, preparation_time: itemPrepTime };
                console.log("Sending payload:", payload);
                console.log("Sending JSON string:", JSON.stringify(payload));

                try {
                    const response = await fetch('/api/cart/add', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(payload),
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
                        // Handle 401 Unauthorized specifically
                        if (response.status === 401) {
                            alert("You are not logged in. Please log in to add items to your cart.");
                            window.location.href = "/login"; // Redirect to login
                        }
                        return;
                    }

                    const result = await response.json();
                    if (result.success) {
                        console.log(`'${itemName}' added to cart! Response:`, result);
                        convertButtonToQtyControls(clickedButton, itemId, 1); // Convert immediately
                        fetchCartItemsForCount(); // Update cart count in header
                    } else {
                        console.error(`Failed to add '${itemName}' to cart: ${result.message}`);
                    }
                } catch (error) {
                    console.error('Error adding to cart:', error);
                }
            });
        });

        // Add event listeners for category filters
        document.querySelectorAll(".menu-filter").forEach((btn) => {
            btn.addEventListener("click", () => {
                const cat = btn.dataset.category;
                document.querySelectorAll(".menu-filter").forEach((f) =>
                    f.classList.remove("bg-green-500", "text-white")
                );
                btn.classList.add("bg-green-500", "text-white");
                document.querySelectorAll(".menu-item").forEach((it) => {
                    it.style.display =
                        cat === "All" || it.dataset.category === cat ? "flex" : "none"; // Use 'flex' for display
                });
            });
        });

        // Add event listeners for search
        const search = document.getElementById("menu-search");
        if (search)
            search.addEventListener("input", () => {
                const q = search.value.toLowerCase();
                document.querySelectorAll(".menu-item").forEach((it) => {
                    it.style.display = it.dataset.name.toLowerCase().includes(q)
                        ? "flex"
                        : "none"; // Use 'flex' for display
                });
            });
    }

    /**
     * Converts an "Add to Cart" button into quantity control buttons (+, -, input).
     * @param {HTMLElement} buttonEl - The "Add to Cart" button element.
     * @param {string} itemId - The ID of the item.
     * @param {number} qty - The initial quantity.
     */
    function convertButtonToQtyControls(buttonEl, itemId, qty) {
        buttonEl.style.display = "none";
        const wrapper = buttonEl.parentElement; // The parent div of the button
        let controls = wrapper.querySelector(`[data-qty-controls="${itemId}"]`);

        if (!controls) { // Create controls only if they don't already exist for this item
            controls = document.createElement("div");
            controls.setAttribute("data-qty-controls", itemId);
            controls.className = "mt-4 flex items-center gap-2";
            controls.innerHTML = `
                <button class="decrement-btn h-8 w-8 rounded-full bg-[#f2f4f1] text-[#131612] flex items-center justify-center font-bold text-lg cursor-pointer">-</button>
                <input class="qty-input text-center w-10 px-0 text-black font-bold bg-white rounded-md border border-gray-300" type="number" value="${qty}" readonly />
                <button class="increment-btn h-8 w-8 rounded-full bg-[#f2f4f1] text-[#131612] flex items-center justify-center font-bold text-lg cursor-pointer">+</button>
            `;
            wrapper.appendChild(controls);

            // Attach listeners to new buttons
            const dec = controls.querySelector(".decrement-btn");
            const inc = controls.querySelector(".increment-btn");
            const qtyInput = controls.querySelector(".qty-input");

            inc.addEventListener("click", async () => {
                const newQty = parseInt(qtyInput.value) + 1;
                await updateQty(itemId, newQty);
                qtyInput.value = newQty; // Update input directly for responsiveness
            });

            dec.addEventListener("click", async () => {
                const newQty = Math.max(0, parseInt(qtyInput.value) - 1);
                const success = await updateQty(itemId, newQty);
                if (success) {
                    if (newQty === 0) {
                        controls.remove(); // Remove controls if quantity drops to 0
                        buttonEl.style.display = "block"; // Show original add to cart button
                    } else {
                        qtyInput.value = newQty; // Update input directly
                    }
                }
            });
        } else {
            // If controls already exist, just update the quantity input
            controls.querySelector('.qty-input').value = qty;
            buttonEl.style.display = "none"; // Ensure original button is hidden if controls exist
        }
    }

    /**
     * Checks existing items in cart when menu loads and converts their buttons to qty controls.
     */
    async function checkAndConvertExistingCartItems() {
        try {
            const response = await fetch('/api/cart');
            if (!response.ok) {
                console.error("Failed to fetch cart for pre-conversion:", response.status);
                return;
            }
            const cartData = await response.json();
            const cartItems = cartData.cart_items || [];

            cartItems.forEach(item => {
                const menuButton = document.querySelector(`.add-to-cart-btn[data-item-id="${item.id}"]`);
                if (menuButton) {
                    convertButtonToQtyControls(menuButton, item.id, item.quantity);
                }
            });
             // Update the global cart count based on fetched items
             const totalCartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
             const cartCountEl = document.getElementById("cart-count");
             if (cartCountEl) {
                 cartCountEl.textContent = totalCartQuantity;
             }

        } catch (error) {
            console.error("Error checking and converting existing cart items:", error);
        }
    }


    /**
     * Updates the quantity of an item in the backend cart.
     * @param {string} itemId - The ID of the item.
     * @param {number} quantity - The new quantity.
     */
    async function updateQty(itemId, quantity) {
        try {
            const response = await fetch("/api/cart/update_quantity", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ item_id: itemId, quantity }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`HTTP error updating quantity! Status: ${response.status}, Response: ${errorText}`);
                if (response.status === 401) {
                    alert("Your session has expired. Please log in again.");
                    window.location.href = "/login";
                }
                return false;
            }
            const result = await response.json();
            console.log(`Update quantity result for ${itemId}:`, result);
            fetchCartItemsForCount(); // Update the cart count in header
            return result.success;
        } catch (error) {
            console.error('Error in updateQty:', error);
            return false;
        }
    }

    /**
     * Fetches cart items specifically to update the cart count in the header.
     * This avoids full cart re-render when only count is needed.
     */
    async function fetchCartItemsForCount() {
        try {
            const response = await fetch('/api/cart');
            if (!response.ok) {
                 console.error("Failed to fetch cart for count update:", response.status);
                 return;
            }
            const data = await response.json();
            const cartItems = data.cart_items || [];
            const totalCartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
            const cartCountEl = document.getElementById("cart-count");
            if (cartCountEl) {
                cartCountEl.textContent = totalCartQuantity;
            }
        } catch (error) {
            console.error("Error fetching cart for count:", error);
        }
    }


    // --- Cart Page Logic ---
    function attachCartEventListeners() {
        console.log("Attaching cart page event listeners.");
        fetchCartItems(); // Fetch and render cart items when cart page is loaded

        const checkoutBtn = document.getElementById("checkout-btn");
        if (checkoutBtn) {
            checkoutBtn.addEventListener("click", async () => {
                console.log("Checkout button clicked.");
                try {
                    const res = await fetch("/api/cart");
                    if (!res.ok) {
                        console.error("Failed to fetch cart for checkout confirmation:", res.status);
                        return;
                    }
                    const data = await res.json();
                    const items = data.cart_items || [];

                    if (!items.length) {
                        console.warn("Cart is empty, cannot place order.");
                        showCustomConfirm("Your cart is empty. Please add items before placing an order.", () => {}); // Use custom modal
                        return;
                    }

                    // Compute estimated wait time based on backend logic (simulated for now)
                    // The backend /api/place_order will return the actual estimated time.
                    // For client-side display before placing, a rough estimate.
                    const myOrderPrepTime = items.reduce((maxTime, item) => {
                        return Math.max(maxTime, item.preparation_time || 0);
                    }, 0);
                    let estimatedUserWaitTime = myOrderPrepTime; // Simpler client-side estimate

                    showCustomConfirm(`Your order will take approximately ${estimatedUserWaitTime} minutes. Do you want to place the order?`, async (result) => {
                        if (result) {
                            console.log("User confirmed order placement.");
                            // Send the order to the backend
                            const placeOrderResponse = await fetch("/api/place_order", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                cart_items: items,
                                user_email: localStorage.getItem("userEmail") // or session email
                            }),

                            });

                            if (!placeOrderResponse.ok) {
                                const errorText = await placeOrderResponse.text();
                                console.error(`HTTP error! Status: ${placeOrderResponse.status}, Response: ${errorText}`);
                                if (placeOrderResponse.status === 401) {
                                    alert("Your session has expired. Please log in again to place order.");
                                    window.location.href = "/login";
                                } else {
                                    alert(`Failed to place order: ${placeOrderResponse.statusText}. Check console.`);
                                }
                                return;
                            }

                            const orderResult = await placeOrderResponse.json();
                            if (orderResult.success) {
                                console.log("Order placed successfully:", orderResult);
                                // Removed notification pop-up call here
                                showCustomConfirm("Order placed successfully! Redirecting to dashboard...", () => {
                                    fetchCartItemsForCount(); // Reset cart count to 0 in header
                                    loadPartial('home'); // Redirect to dashboard to see live monitoring
                                });
                            } else {
                                console.error("Failed to place order:", orderResult.message);
                                showCustomConfirm(`Failed to place order: ${orderResult.message}`, () => {});
                            }
                        } else {
                            console.log("Order placement cancelled.");
                        }
                    });

                } catch (error) {
                    console.error("Error during checkout process:", error);
                    showCustomConfirm("An error occurred during checkout. Please try again.", () => {});
                }
            });
        }
    }

    /**
     * Fetches and renders current user's cart items.
     */
    async function fetchCartItems() {
        console.log("Fetching cart items for display...");
        try {
            const res = await fetch("/api/cart");
            if (!res.ok) {
                const errorText = await res.text();
                console.error(`HTTP error fetching cart: ${res.status}, Response: ${errorText}`);
                if (res.status === 401) {
                    // This might happen if user's session expires while on cart page
                    alert("Your session has expired. Please log in again.");
                    window.location.href = "/login";
                }
                return;
            }
            const data = await res.json();
            const cont = document.getElementById("cart-items-container");
            const tot = document.getElementById("cart-total-price");
            const empty = document.getElementById("empty-cart-message");

            if (!cont || !tot || !empty) {
                console.error("One or more cart display elements not found. Cannot render cart.");
                return;
            }

            cont.innerHTML = ""; // Clear existing items
            let total = 0;
            const items = data.cart_items || [];
            console.log("Fetched cart items:", items);

            if (items.length > 0) {
                empty.style.display = "none";
                items.forEach((it) => {
                    const lineTotal = (it.price * it.quantity) / 100.0;
                    total += lineTotal;
                    cont.insertAdjacentHTML(
                        "beforeend",
                        `
                        <div class="flex items-center gap-4 bg-white px-4 min-h-[72px] py-2 justify-between border-b border-gray-100">
                            <div class="flex items-center gap-4">
                                <img src="${it.image_url}" alt="${it.name}" class="item-image bg-center bg-no-repeat aspect-square bg-cover rounded-lg size-14" />
                                <div class="flex flex-col justify-center">
                                    <p class="text-[#131612] text-base font-medium leading-normal line-clamp-1">${it.name}</p>
                                    <p class="text-[#6f816a] text-sm font-normal leading-normal line-clamp-2">₹${(it.price / 100).toFixed(2)}</p>
                                </div>
                            </div>
                            <div class="shrink-0 flex items-center gap-4">
                                <span class="text-base font-bold text-gray-800">₹${lineTotal.toFixed(2)}</span>
                                <div class="flex items-center gap-2 text-[#131612]">
                                    <button class="text-base font-medium leading-normal flex h-7 w-7 items-center justify-center rounded-full bg-[#f2f4f1] cursor-pointer update-quantity-btn" data-item-id="${it.id}" data-action="decrement">-</button>
                                    <input
                                        class="text-base font-medium leading-normal w-4 p-0 text-center bg-transparent focus:outline-0 focus:ring-0 focus:border-none border-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                        type="number"
                                        value="${it.quantity}"
                                        data-item-id="${it.id}"
                                        readonly
                                    />
                                    <button class="text-base font-medium leading-normal flex h-7 w-7 items-center justify-center rounded-full bg-[#f2f4f1] cursor-pointer update-quantity-btn" data-item-id="${it.id}" data-action="increment">+</button>
                                </div>
                                <button class="text-red-500 material-icons remove-item-btn" data-item-id="${it.id}">delete</button>
                            </div>
                        </div>
                    `
                    );
                });
                tot.textContent = `₹${total.toFixed(2)}`;
            } else {
                empty.style.display = "block";
                tot.textContent = "₹0.00";
            }
            attachCartItemEventListeners(); // Re-attach listeners for dynamically added cart items
            fetchCartItemsForCount(); // Update the global cart count based on newly rendered cart
        } catch (error) {
            console.error("Error fetching or rendering cart items:", error);
            const cartItemsContainer = document.getElementById("cart-items-container");
            if (cartItemsContainer) {
                cartItemsContainer.innerHTML = `<p class="text-red-500 text-center py-8">Failed to load cart items.</p>`;
            }
        }
    }

    /**
     * Attaches event listeners to quantity update and remove buttons in the cart.
     */
    function attachCartItemEventListeners() {
        console.log("Attaching cart item quantity/remove event listeners.");
        document.querySelectorAll(".update-quantity-btn").forEach((button) => {
            button.addEventListener("click", async (e) => {
                const itemId = e.target.dataset.itemId;
                const action = e.target.dataset.action;
                const inputElement = e.target.parentNode.querySelector('input[type="number"]');
                let currentQuantity = parseInt(inputElement.value);
                let newQuantity;

                if (action === "increment") {
                    newQuantity = currentQuantity + 1;
                } else if (action === "decrement") {
                    newQuantity = currentQuantity - 1;
                }

                if (newQuantity < 0) newQuantity = 0; // Prevent negative quantity

                console.log(`Updating quantity for ${itemId}: ${currentQuantity} -> ${newQuantity}`);
                const success = await updateQty(itemId, newQuantity); // Use the centralized updateQty
                if (success) {
                    fetchCartItems(); // Re-fetch and re-render cart to update totals and quantities
                } else {
                    console.error("Failed to update quantity via API.");
                }
            });
        });

        document.querySelectorAll(".remove-item-btn").forEach((button) => {
            button.addEventListener("click", async (e) => {
                const itemId = e.target.dataset.itemId;
                console.log(`Remove item clicked for item: ${itemId}`);
                showCustomConfirm("Are you sure you want to remove this item?", async (result) => {
                    if (result) {
                        console.log("User confirmed item removal.");
                        try {
                            const response = await fetch("/api/cart/remove", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ item_id: itemId }),
                            });
                            if (!response.ok) {
                                const errorText = await response.text();
                                console.error(`HTTP error removing item: ${response.status}, Response: ${errorText}`);
                                if (response.status === 401) {
                                    alert("Your session has expired. Please log in again.");
                                    window.location.href = "/login";
                                }
                                return;
                            }
                            const result = await response.json();
                            if (result.success) {
                                console.log(`Item ${itemId} removed.`);
                                fetchCartItems(); // Re-fetch and re-render cart
                                // No need for bumpCartCount here, fetchCartItems will correct global count
                            } else {
                                console.error(`Failed to remove item: ${result.message}`);
                            }
                        } catch (error) {
                            console.error("Error removing item:", error);
                        }
                    } else {
                        console.log("Item removal cancelled.");
                    }
                });
            });
        });
    }

    // --- Dashboard logic ---
    async function fetchDashboardData() {
        console.log("Fetching dashboard data...");
        try {
            const response = await fetch("/api/dashboard_data");
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`HTTP error fetching dashboard data: ${response.status}, Response: ${errorText}`);
                 if (response.status === 401) {
                    alert("Your session has expired. Please log in again.");
                    window.location.href = "/login";
                }
                return;
            }
            const data = await response.json();
            console.log("Dashboard data received:", data);

            // Update dashboard cards
            const totalOrdersCount = document.getElementById("total-orders-count");
            const pendingOrdersCount = document.getElementById("pending-orders-count");
            const completedOrdersCount = document.getElementById("completed-orders-count");
            const preparingOrdersCount = document.getElementById("preparing-orders-count"); // Assuming you have this ID

            if (totalOrdersCount) totalOrdersCount.textContent = data.total_orders_count;
            if (pendingOrdersCount) pendingOrdersCount.textContent = data.pending_orders_count;
            if (completedOrdersCount) completedOrdersCount.textContent = data.completed_orders_count;
            if (preparingOrdersCount) preparingOrdersCount.textContent = data.preparing_orders_count;


            // Update user's order status speedometer
            const speedometerValueSpan = document.getElementById("speedometer-value");
            const speedometerLabelSpan = document.getElementById("speedometer-label");
            const speedometerNeedle = document.getElementById("speedometer-needle");
            const speedometerFillPreparing = document.getElementById("speedometer-fill-preparing");
            const peopleAheadSpan = document.getElementById("people-ahead");
            const estimatedWaitTimeSpan = document.getElementById("estimated-wait-time");

            if (peopleAheadSpan) peopleAheadSpan.textContent = data.people_ahead || 0;
            if (estimatedWaitTimeSpan) estimatedWaitTimeSpan.textContent = `${data.estimated_user_wait_time || 0} mins`;

            if (data.user_latest_order) {
                const order = data.user_latest_order;
                let progress = 0;
                let statusText = 'No active order';

                // Ensure order_time and estimated_completion_time are valid numbers before calculation
                const orderTimeMs = (typeof order.order_time === 'number' ? order.order_time : 0) * 1000;
                const estimatedCompletionTime = (typeof order.estimated_completion_time === 'number' ? order.estimated_completion_time : 0) * 1000;
                const nowMs = Date.now();
                
                console.log(`DEBUG: Order Data - order_time: ${order.order_time}, est_completion: ${order.estimated_completion_time}, status: ${order.status}`);
                console.log(`DEBUG: Calculated MS - orderTimeMs: ${orderTimeMs}, estimatedCompletionTime: ${estimatedCompletionTime}, nowMs: ${nowMs}`);


                if (order.status === 'pending' || order.status === 'preparing') {
                    if (estimatedCompletionTime > orderTimeMs) { // Ensure duration is positive
                        const totalDurationMs = estimatedCompletionTime - orderTimeMs;
                        const elapsedDurationMs = nowMs - orderTimeMs;
                        
                        console.log(`DEBUG: Durations - totalDurationMs: ${totalDurationMs}, elapsedDurationMs: ${elapsedDurationMs}`);

                        progress = Math.min(100, Math.max(0, (elapsedDurationMs / totalDurationMs) * 100));
                        console.log(`DEBUG: Calculated progress: ${progress}%`);

                    } else {
                        // This case implies order should be considered finished or started instantly
                        console.warn("DEBUG: Estimated completion time is not greater than order time. Assuming progress 100% if order is active.");
                        progress = 100; // If times are invalid, assume it's done or nearly done
                    }
                    statusText = order.status === 'pending' ? 'Pending' : 'Preparing';
                } else if (order.status === 'completed') {
                    progress = 100;
                    statusText = 'Completed';
                }

                if (speedometerValueSpan) speedometerValueSpan.textContent = `${Math.round(progress)}%`;
                if (speedometerLabelSpan) speedometerLabelSpan.textContent = statusText;

                const needleRotation = -90 + (progress / 100) * 180;
                if (speedometerNeedle) speedometerNeedle.style.transform = `translateX(-50%) rotate(${needleRotation}deg)`;

                const fillRotation = (progress / 100) * 180;
                if (speedometerFillPreparing) speedometerFillPreparing.style.transform = `rotate(${fillRotation}deg)`;

                if (speedometerFillPreparing) {
                    if (order.status === 'completed') {
                        speedometerFillPreparing.classList.remove('speedometer-fill-preparing');
                        speedometerFillPreparing.classList.add('speedometer-fill-completed');
                    } else {
                        speedometerFillPreparing.classList.remove('speedometer-fill-completed');
                        speedometerFillPreparing.classList.add('speedometer-fill-preparing');
                    }
                }
                // Removed In-App Notification Logic
            } else {
                // No active order, reset speedometer
                if (speedometerValueSpan) speedometerValueSpan.textContent = `0%`;
                if (speedometerLabelSpan) speedometerLabelSpan.textContent = 'No active order';
                if (speedometerNeedle) speedometerNeedle.style.transform = `translateX(-50%) rotate(-90deg)`;
                if (speedometerFillPreparing) {
                    speedometerFillPreparing.style.transform = `rotate(0deg)`;
                    speedometerFillPreparing.classList.remove('speedometer-fill-completed');
                    speedometerFillPreparing.classList.add('speedometer-fill-preparing');
                }
            }

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        }
    }

    // --- Speedometer needle updates ---
    function startHomeLiveUpdater() {
        if (dashboardUpdateInterval) {
            clearInterval(dashboardUpdateInterval); // Clear existing interval if any
        }
        // Update every 5 seconds
        dashboardUpdateInterval = setInterval(fetchDashboardData, 5000);
        console.log("Started user dashboard updater.");
    }
});
