const express = require('express');
const cors = require('cors');
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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


        app.get("/artwork", async (req, res) => {
            const query = { visibility: "Public" }
            const cursor = arts_collections.find(query).sort({ createdAt: -1 });
            const arts = await cursor.toArray();
            if (!arts) return res.status(404).send({ message: "arts not found" });
            res.send(arts);
        });
        app.get("/artwork/limit", async (req, res) => {
            const query = { visibility: "Public" }
            const cursor = arts_collections.find(query).sort({ createdAt: -1 }).limit(6);
            const arts = await cursor.toArray();
            if (!arts) return res.status(404).send({ message: "arts not found" });
            res.send(arts);
        });

        app.get("/artwork/:id", async (req, res) => {
            const ID = req.params.id;
            const query = { _id: new ObjectId(ID) }
            const art = await arts_collections.findOne(query);
            if (!art) return res.status(404).send({ message: "art not found" });
            res.send(art);
        });

        app.get("/artwork/user/:email", async (req, res) => {
            const email = req.params.email;
            const query = { artistEmail: email }
            const cursor = arts_collections.find(query);
            const arts = await cursor.toArray();
            if (!arts) return res.status(404).send({ message: "arts not found" });
            res.send(arts);
        });

        app.put("/artwork/:id", async (req, res) => {
            const id = req.params.id;
            const updatedArt = req.body;
            console.log("Incoming update for ID:", id);
            console.log("Data received:", updatedArt);

            //jibon bara gese amar eta korte jaye
            delete updatedArt._id;
            //jibon bara gese amar eta korte jaye

            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: updatedArt,
            };

            try {
                const result = await arts_collections.updateOne(filter, updateDoc);
                res.send(result);
            } catch (error) {
                console.error("Update error:", error);
                res.send({ message: "Failed to update artwork", error });
            }
        });



        app.delete("/artwork/:id", async (req, res) => {
            const id = req.params.id;

            try {
                const query = { _id: new ObjectId(id) };
                const result = await arts_collections.deleteOne(query);

                if (result.deletedCount === 0) {
                    return res.status(404).send({ message: "Artwork not found" });
                }

                res.send({ success: true, message: "Artwork deleted successfully" });
            } catch (error) {
                console.error("Delete error:", error);
                res.send({ message: "Internal Server Error" });
            }
        });


        app.post("/add-artwork", async (req, res) => {
            try {
                const new_art = {
                    ...req.body,
                    //do not delete this line !!!!
                    //clinet side has not this data tai add kora lagse
                    createdAt: new Date(),
                };

                const result = await arts_collections.insertOne(new_art);
                console.log(`document inserted >>> '_id': ${result.insertedId}`);

                res.status(201).json(result);
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: "Failed to add artwork" });
            }
        });

        app.post("/users/:email/favorites", async (req, res) => {
            const { email } = req.params;
            const { artworkId } = req.body;

            if (!artworkId) return res.status(400).send({ message: "artworkId is required" });

            try {
                const result = await arts_users.updateOne(
                    { email },
                    { $addToSet: { user_fav_list: new ObjectId(artworkId) } } // prevents duplicates
                );

                if (result.matchedCount === 0) {
                    return res.status(404).send({ message: "User not found" });
                }

                res.send({ success: true, message: "Added to favorites" });
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Failed to add favorite", error });
            }
        });

        app.delete("/users/:email/favorites/:artworkId", async (req, res) => {
            const { email, artworkId } = req.params;

            try {
                const result = await arts_users.updateOne(
                    { email },
                    { $pull: { user_fav_list: new ObjectId(artworkId) } }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).send({ message: "User not found" });
                }

                res.send({ success: true, message: "Removed from favorites" });
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Failed to remove favorite", error });
            }
        });

        app.get("/users/:email/favorites", async (req, res) => {
            const { email } = req.params;

            try {
                const user = await arts_users.findOne({ email });
                if (!user) return res.status(404).send({ message: "User not found" });

                const favArtworks = await arts_collections
                    .find({ _id: { $in: user.user_fav_list || [] } })
                    .toArray();

                res.send(favArtworks);
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Failed to fetch favorites", error });
            }
        });

        app.post("/artwork/:id/like", async (req, res) => {
            const id = req.params.id;
            const { userEmail } = req.body; // send current user's email

            try {
                const artwork = await arts_collections.findOne({ _id: new ObjectId(id) });
                if (!artwork) return res.status(404).send({ message: "Artwork not found" });

                // Track likes per user to prevent multiple likes by same user
                let likes = artwork.likes || 0;
                let likedBy = artwork.likedBy || [];

                if (!likedBy.includes(userEmail)) {
                    likes += 1;
                    likedBy.push(userEmail);
                } else {
                    likes -= 1;
                    likedBy = likedBy.filter((email) => email !== userEmail);
                }

                await arts_collections.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { likes, likedBy } }
                );

                res.send({ likes, likedBy });
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });

        //await client.db("admin").command({ ping: 1 });
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