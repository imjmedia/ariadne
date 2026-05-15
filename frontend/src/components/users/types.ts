/**
 * @fileoverview Shared row shape for admin user list (GET /users).
 */
export interface UserRow {
  id: string
  email: string
  name: string | null
  role: "admin" | "developer"
  hasMcpToken: boolean
  createdAt: string
  updatedAt: string
}
