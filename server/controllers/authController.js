import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import transporter from "../config/nodemailer.js";

import userModel from "../models/userModels.js";

export const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ message: "All fields are required" });

  const existingUser = await userModel.findOne({ email });
  if (existingUser)
    return res.status(400).json({ message: "User already exists" });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new userModel({ name, email, password: hashedPassword });

    await newUser.save();

    //generate token for authentication
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: "Welcome",
      message: "Welcome to our platform dear user",
    };

    await transporter.sendMail(mailOptions);

    return res
      .status(201)
      .json({ success: true, message: "User registered successfully", token });
  } catch (error) {
    res.status(201).json({ success: false, message: error.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const user = await userModel.findOne({ email });
    if (!user) return res.status(400).json({ message: "User does not exist" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    //generate token for authentication
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ success: true, message: "Login successful" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    });
    return res.json({ success: true, message: "Logged out" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export const sendVerifyOtp = async (req, res) => {
  try {
    const { userId } = req.body; //userId will be from the token in the cookie.
    const user = await userModel.findById(userId);

    if (!user) return res.status(400).json({ message: "User does not exist" });

    if (user.isAccountVerified)
      return res.status(400).json({ message: "Account already verified" });

    const otp = Math.floor(100000 + Math.random() * 900000);
    user.verifyOtp = otp;
    user.verifyOtpExpires = Date.now() + 5 * 60 * 1000;

    await user.save();

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "Verify OTP",
      text: `Your OTP is ${otp}`,
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

//verify email
export const verifyEmail = async (req, res) => {
  const { userId, otp } = req.body;
  //userId will be from the token in the cookie. need middleware to get userId from token

  if (!userId || !otp)
    return res.status(400).json({ message: "All fields are required" });

  try {
    //find user
    const user = await userModel.findById(userId);
    if (!user) return res.status(400).json({ message: "User does not exist" });

    if (user.verifyOtp === "" || user.verifyOtp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });
    if (user.verifyOtpExpires < Date.now())
      return res.status(400).json({ message: "OTP expired" });

    user.isAccountVerified = true;
    user.verifyOtp = "";
    user.verifyOtpExpires = "";
    await user.save();
    return res.json({
      success: true,
      message: "Account verified successfully",
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export const isAuthenticated = async (req, res) => {
  //middleware function will be executed before this function
  try {
    return res.json({ success: true, message: "Authenticated" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export const sendResetOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "Email is required" });

  const user = await userModel.findOne({ email });
  if (!user) return res.status(400).json({ message: "User does not exist" });

  const otp = Math.floor(100000 + Math.random() * 900000);
  user.resetOtp = otp;
  user.resetOtpExpireAt = Date.now() + 5 * 60 * 1000;

  await user.save();
  //send otp via email
  const mailOptions = {
    from: process.env.SENDER_EMAIL,
    to: email,
    subject: "Reset OTP",
    text: `Your OTP is ${otp}`,
  };

  await transporter.sendMail(mailOptions);
  return res.json({ success: true, message: "OTP sent successfully" });
};

//reset user password
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const user = await userModel.findOne({ email });
    if (!user) return res.status(400).json({ message: "User does not exist" });

    if (user.resetOtp === "" || user.resetOtp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    if (user.resetOtpExpireAt < Date.now())
      return res.status(400).json({ message: "OTP expired" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetOtp = "";
    user.resetOtpExpireAt = "";
    await user.save();

    return res.json({ success: true, message: "Password reset successful" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
