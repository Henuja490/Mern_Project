const {MongoClient, ObjectId} = require("mongodb")
const express = require("express")
const multer = require('multer')
const upload = multer()
const sanitize = require("sanitize-html")
const fse = require('fs-extra')
const shrap = require('sharp')
const React = require("react")
const ReactDOMServer = require("react-dom/server")
const AnimalCard = require("./src/components/AnimalCard").default
let db
const path = require('path')

fse.ensureDirSync(path.join("public","uploaded-photos"))
const app = express()
app.set("view engine","ejs")
app.set("views","./views")
app.use(express.static("public"))
app.use(express.json())
app.use(express.urlencoded({extended: false}))
function passwordProtected(req,res,next){
    res.set("WWW-Authenticate","Basic realm='our MERN app' ")
    if (req.headers.authorization == "Basic aGVudWphOmhlbnVqYTEyMzQ=") {
        next()
    } else {
        console.log(req.headers.authorization)
        res.status(401).send("Try again")
    }
}
app.get("/",async(req,res)=>{
    const allAnimals = await db.collection("animals").find().toArray()
    const generatedHTML = ReactDOMServer.renderToString(
        <div className="container">
            <div className="animal-grid mb-3">
                {allAnimals.map(animal => <AnimalCard  key= {animal._id} name={animal.name} species={animal.species} photo={animal.photo} id={animal._id} readOnly={true}/>)}
            </div>
            <p><a href="/admin">Login / manage the animal listings.</a></p>
        </div>
    )
    res.render("home",{generatedHTML});
})


app.get("/admin",passwordProtected,(req,res)=>{

    res.render("admin")
})

app.get("/api/animals",passwordProtected,async (req,res)=>{
    const allAnimals = await db.collection("animals").find().toArray()
    res.json(allAnimals)
})

app.post("/create-animal" ,upload.single("photo"),ourCleanup ,async (req,res)=>{
    if (req.file) {
        const photofile = `${Date.now()}.jpg`
        await shrap(req.file.buffer).resize(844,456).jpeg({quality: 60}).toFile(path.join("public","uploaded-photos",photofile))
        req.cleanData.photo = photofile
    }
    const info = await db.collection("animals").insertOne(req.cleanData)
    const newAnimal = await db.collection("animals").findOne({_id: new ObjectId(info.insertedID)})
    res.send(newAnimal)
})

app.delete("/animal/:id", async(req,res)=>{
    if(typeof req.params.id != "string") req.params.id = ""
    const doc = await db.collection("animals").findOne({_id: new ObjectId(req.params.id)})
    if(doc.photo){
        fse.remove(path.join("public","uploaded-photos",doc.photo))
    }
    db.collection("animals").deleteOne({_id: new ObjectId(req.params.id)})
})

app.post("/update-animal" , upload.single("photo"),ourCleanup,async(req,res)=>{
    if(req.file){
        const photofile = `${Date.now()}.jpg`
        await shrap(req.file.buffer).resize(844,456).jpeg({quality: 60}).toFile(path.join("public","uploaded-photos",photofile))
        req.cleanData.photo = photofile
        const info = await db.collection("animals").findOneAndUpdate({ _id: new ObjectId(req.body._id) }, { $set: req.cleanData })
        if (info.photo) {
            fse.remove(path.join("public", "uploaded-photos", info.photo))
        }
        res.send(photofile)
    }else{
        const info = await db.collection("animals").findOneAndUpdate({ _id: new ObjectId(req.body._id) }, { $set: req.cleanData })
        res.send(false)
    }
})

function ourCleanup(req,res,next){
    if(typeof req.body.name != "string") req.body.name = ""
    if(typeof req.body.species != "string") req.body.species = ""
    if(typeof req.body._id != "string") req.body._id = ""

    req.cleanData = {
        name: sanitize(req.body.name.trim(),{allowedTags:[],allowedAttributes:{}}),
        species: sanitize(req.body.species.trim(),{allowedTags:[],allowedAttributes:{}})
    }
    next()
}

async function start(){
    const client = new MongoClient("mongodb://root:root@localhost:27017/AmazingMernApp?&authSource=admin")
    await client.connect()
    db = client.db()
    app.listen(3000,(req,res)=>{
        console.log("Connected to the server")
    })
}
start()
