import crypto from "crypto"

export const generateRandomToken = (length = 32): string => {
  return crypto.randomBytes(length).toString("hex")
}

export const generateRandomPassword = (length = 10): string => {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+"
  let password = ""

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length)
    password += charset[randomIndex]
  }

  return password
}

export const formatDate = (date: Date): string => {
  return date.toISOString().split("T")[0]
}

export const calculateDateDifference = (date1: Date, date2: Date): number => {
  const diffTime = Math.abs(date2.getTime() - date1.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}
\
export const paginate =
  <T>(items: T[], page: number = 1, pageSize: number = 10): { items: T[], total: number, page: number, pageSize: number, totalPages: number } => {\
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedItems = items.slice(startIndex, endIndex);
  const totalPages = Math.ceil(items.length / pageSize);
  
  return {\
    items: paginatedItems,
    total: items.length,
    page,
    pageSize,
    totalPages
  };
};

export const sanitizeInput = (input: string): string => {
  // Remove HTML tags\
  let sanitized = input.replace(/<[^>]*>/g, '');
  
  // Escape special characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')\
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  return sanitized;\
};
