import nodemailer from "nodemailer"
import dotenv from "dotenv"

dotenv.config()

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.example.com",
  port: Number.parseInt(process.env.EMAIL_PORT || "587"),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER || "user@example.com",
    pass: process.env.EMAIL_PASS || "password",
  },
})

export const sendVerificationEmail = async (email: string, name: string, token: string) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`

  const mailOptions = {
    from: process.env.EMAIL_FROM || "Rwanda E-Governance <noreply@example.com>",
    to: email,
    subject: "Verify Your Email - Rwanda E-Governance",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Email Verification</h2>
        <p>Hello ${name},</p>
        <p>Thank you for registering with the Rwanda E-Governance platform. Please verify your email address by clicking the button below:</p>
        <p>
          <a href="${verificationUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
        </p>
        <p>If you did not create an account, please ignore this email.</p>
        <p>Regards,<br>Rwanda E-Governance Team</p>
      </div>
    `,
  }

  return transporter.sendMail(mailOptions)
}

export const sendPasswordResetEmail = async (email: string, name: string, token: string) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`

  const mailOptions = {
    from: process.env.EMAIL_FROM || "Rwanda E-Governance <noreply@example.com>",
    to: email,
    subject: "Reset Your Password - Rwanda E-Governance",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>Hello ${name},</p>
        <p>You requested to reset your password. Please click the button below to set a new password:</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
        </p>
        <p>If you did not request a password reset, please ignore this email.</p>
        <p>Regards,<br>Rwanda E-Governance Team</p>
      </div>
    `,
  }

  return transporter.sendMail(mailOptions)
}

export const sendTicketStatusUpdateEmail = async (
  email: string,
  name: string,
  ticketId: string,
  ticketTitle: string,
  newStatus: string,
  note: string,
) => {
  const ticketUrl = `${process.env.FRONTEND_URL}/tickets/${ticketId}`

  const mailOptions = {
    from: process.env.EMAIL_FROM || "Rwanda E-Governance <noreply@example.com>",
    to: email,
    subject: `Ticket Status Update - ${ticketTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Ticket Status Update</h2>
        <p>Hello ${name},</p>
        <p>Your ticket "${ticketTitle}" has been updated to <strong>${newStatus}</strong>.</p>
        ${note ? `<p><strong>Note:</strong> ${note}</p>` : ""}
        <p>
          <a href="${ticketUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Ticket</a>
        </p>
        <p>Regards,<br>Rwanda E-Governance Team</p>
      </div>
    `,
  }

  return transporter.sendMail(mailOptions)
}

export const sendNewCommentEmail = async (
  email: string,
  name: string,
  ticketId: string,
  ticketTitle: string,
  commenterName: string,
) => {
  const ticketUrl = `${process.env.FRONTEND_URL}/tickets/${ticketId}`

  const mailOptions = {
    from: process.env.EMAIL_FROM || "Rwanda E-Governance <noreply@example.com>",
    to: email,
    subject: `New Comment on Ticket - ${ticketTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Comment on Your Ticket</h2>
        <p>Hello ${name},</p>
        <p>${commenterName} has added a new comment to your ticket "${ticketTitle}".</p>
        <p>
          <a href="${ticketUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Comment</a>
        </p>
        <p>Regards,<br>Rwanda E-Governance Team</p>
      </div>
    `,
  }

  return transporter.sendMail(mailOptions)
}
