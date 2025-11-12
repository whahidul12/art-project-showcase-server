const express = require('express');
const cors = require('cors');
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express()
const port = process.env.PORT || 3000

//middleware
app.use(cors())
app.use(express.json())


const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

app.get('/', (req, res) => {
    res.send("app is running")
})

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const arts_db = client.db("art_folio_db");
        const arts_users = arts_db.collection("arts_users");
        const arts_collections = arts_db.collection("arts_collections");

        app.get("/users/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await arts_users.findOne(query);
            if (!user) return res.status(404).send({ message: "User not found" });
            res.send(user);
        });

        app.post("/users", async (req, res) => {
            const newUser = req.body;
            const result = await arts_users.insertOne(newUser);
            res.send(result)
        })

        app.get("/artwork/:email", async (req, res) => {
            const email = req.params.email;
            const query = { artistEmail: email }
            const cursor = arts_collections.find(query);
            const arts = await cursor.toArray();
            if (!arts) return res.status(404).send({ message: "arts not found" });
            res.send(arts);
        });

        app.post("/add-artwork", async (req, res) => {
            const new_art = req.body;
            console.log(new_art);
            const result = await arts_collections.insertOne(new_art);
            console.log(`document inserted >>> '_id': ${result.insertedId}`);
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`app is running on http://localhost:${port}/`);
})