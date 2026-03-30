// --- INITIALIZE SUPABASE ---
const SUPABASE_URL = 'https://tcnbrajpchavyccfjbdu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_c-tY_nSFpJYFE71AfwI6kQ_jb2OXm5Q';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let bag = {};

function addToBag(btn, name, price, sizeId) {
    const size = document.getElementById(sizeId).value;
    const itemKey = `${name}-${size}`;
    if (bag[itemKey]) { bag[itemKey].qty += 1; }
    else { bag[itemKey] = { name: name, size: size, price: price, qty: 1 }; }
    updateUI();

    const originalText = btn.innerText;
    btn.innerText = "ADDED!";
    btn.style.background = "#ff4d00";
    setTimeout(() => {
        btn.innerText = originalText;
        btn.style.background = "#000";
    }, 800);
}

function removeFromBag(key) {
    if (bag[key].qty > 1) { bag[key].qty -= 1; }
    else { delete bag[key]; }
    updateUI();
}

function updateUI() {
    const summary = document.getElementById('bag-summary');
    const payBtn = document.getElementById('payBtn');
    const deliveryFee = parseInt(document.getElementById('deliveryZone').value);
    const cartCount = document.getElementById('cart-count');
    let itemsSubtotal = 0;
    let totalItemsCount = 0;
    const keys = Object.keys(bag);

    if (keys.length === 0) {
        summary.innerHTML = '<p class="text-muted text-center mb-0">Your bag is empty. Pick your drip above.</p>';
        payBtn.disabled = true;
        cartCount.innerText = 0;
        return;
    }

    let html = '<h6 class="fw-bold text-danger mb-3">ORDER SUMMARY:</h6>';
    keys.forEach(key => {
        const item = bag[key];
        itemsSubtotal += (item.price * item.qty);
        totalItemsCount += item.qty;
        html += `<div class="bag-item text-white">
                <span>${item.name} (${item.size}) <strong>x${item.qty}</strong></span>
                <span>${item.price * item.qty} GHS <i class="fas fa-trash-alt remove-btn" onclick="removeFromBag('${key}')"></i></span>
             </div>`;
    });

    const finalTotal = itemsSubtotal + deliveryFee;
    html += `<hr style="border-color: #444;">
         <div class="d-flex justify-content-between small text-secondary"><span>Items:</span><span>${itemsSubtotal} GHS</span></div>
         <div class="d-flex justify-content-between small text-secondary"><span>Delivery:</span><span>${deliveryFee === 0 ? 'FREE' : deliveryFee + ' GHS'}</span></div>
         <h4 class="mt-3 text-white">TOTAL: ${finalTotal} GHS</h4>`;

    summary.innerHTML = html;
    payBtn.disabled = false;
    cartCount.innerText = totalItemsCount;
}

// --- UPDATED PAYMENT LOGIC ---
document.getElementById('paymentForm').onsubmit = function(e) {
    e.preventDefault();
    console.log("Form Submitted...");

    const emailField = document.getElementById('custEmail');
    const deliveryZoneSelect = document.getElementById('deliveryZone');

    // Basic Validation
    if(!emailField.value || Object.keys(bag).length === 0) {
        alert("Please fill in your email and add items to your bag.");
        return;
    }

    const deliveryFee = parseInt(deliveryZoneSelect.value);
    let itemsSubtotal = 0;
    let itemDescriptions = [];

    Object.keys(bag).forEach(key => {
        const item = bag[key];
        itemsSubtotal += (item.price * item.qty);
        itemDescriptions.push(`${item.name} (${item.size}) x${item.qty}`);
    });

    const finalTotal = itemsSubtotal + deliveryFee;
    const itemsString = itemDescriptions.join(', ');
    const zoneText = deliveryZoneSelect.options[deliveryZoneSelect.selectedIndex].text;

    console.log("Calculated Total:", finalTotal);

    // Paystack Configuration
    const handler = PaystackPop.setup({
        key: 'pk_test_a5750e7555808df4446ff2fc42daf8fb9454d13b',
        email: emailField.value,
        amount: Math.round(finalTotal * 100), // Ensure it's a clean integer
        currency: 'GHS',
        callback: function(response) {
            console.log("Payment Successful, Reference:", response.reference);
            saveToSupabase(response.reference, itemsString, zoneText, finalTotal);
        },
        onClose: function() {
            alert('Transaction cancelled.');
        }
    });

    console.log("Attempting to open Paystack...");
    handler.openIframe();
};

async function saveToSupabase(ref, items, zone, total) {
    const name = document.getElementById('custName').value;
    const loc = document.getElementById('custAddress').value;
    const phone = document.getElementById('custPhone').value;
    const email = document.getElementById('custEmail').value;

    console.log("Attempting to save to Supabase...");

    const { data, error } = await _supabase.from('ORDERS').insert([{
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        address: loc,
        delivery_zone: zone,
        items: items,
        total_price: total,
        paystack_ref: ref,
        status: 'Pending'
    }]);

    if (error) {
        // THIS WILL TELL US EXACTLY WHAT IS WRONG
        console.error("SUPABASE ERROR DETAILS:", error.message);
        alert("Order paid but failed to save to dashboard: " + error.message);
    } else {
        console.log("SUCCESS: Order saved to dashboard!");
    }

    // Redirect to WhatsApp (Moved inside a timeout so you can see the error first)
    setTimeout(() => {
        const msg = `*PAID ORDER - REF: ${ref}*%0A%0A*Items:* ${items}%0A*Zone:* ${zone}%0A*Total Paid:* ${total} GHS%0A*Name:* ${name}%0A*Address:* ${loc}`;
        window.location.href = `https://wa.me/233554914575?text=${msg}`;
    }, 1500);
}