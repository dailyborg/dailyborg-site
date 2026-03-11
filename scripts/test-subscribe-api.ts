
// test script to verify local D1 works
async function test() {
    try {
        const payload = {
            email: "test@example.com",
            plan_type: "paid",
            delivery_channel: "email",
            frequency: "weekly",
            topics: ["U.S. Politics", "Technology"]
        };

        const res = await fetch("http://localhost:3000/api/subscribe", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Response:", text);
    } catch (e) {
        console.error(e);
    }
}

test();
