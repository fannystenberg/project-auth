import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/project-authentication";
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.Promise = Promise;

// Defines the port the app will run on. Defaults to 8080, but can be overridden
// when starting the server. Example command to overwrite PORT env variable value:
// PORT=9000 npm start
const port = process.env.PORT || 8080;
const app = express();
const listEndPoints = require('express-list-endpoints');

// User model with validation rules
const { Schema } = mongoose;
const UserSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString("hex")
  }
});
const User = mongoose.model("User", UserSchema);

// Middleware function for authentication
const authenticateUser = async (req, res, next) => {
  // Looks up the user based on the accessToken stored in the header
  const user = await User.findOne({ accessToken: req.header("Authorization") });
  if (user) {
    req.user = user;
    // Allows the protected endpoint to continue exec.
    next();
  } else {
    // If no accessToken was found, access will be denied
    res.status(401).json({ loggedOut: true });
  }
};

// Add middlewares to enable cors and json body parsing
app.use(cors());
app.use(express.json());

// Start defining your routes here
app.get("/", (req, res) => {
  res.json(listEndPoints(app));
});

// Register new user
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  try {
    const newUser = await new User({ username, password: bcrypt.hashSync(password) }).save();
    res.status(201).json({
      success: true,
      response: {
        username: newUser.username,
        accessToken: newUser.accessToken,
        id: newUser._id
      },
      message: "User successfully created"
    })
  } catch(e) {
    res.status(400).json({
      success: false,
      respone: e,
      message: "Could not create user"
    })
  }
});

// Secret endpoint that only can be accessed when logged in as a user
app.get("/secrets", authenticateUser);
app.get("/secrets", (req, res) => {
  res.json({ secret: "This is a super secret message." })
});

// Login as an already registered user
app.post("/signin", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (user && bcrypt.compareSync(password, user.password)) {
    res.status(200).json({
      success: true,
      respone: {
        username: user.username,
        accessToken: user.accessToken,
        id: user._id
      }
    });
  } else {
    res.status(200).json({
      success: false,
      response: "User not found"
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
