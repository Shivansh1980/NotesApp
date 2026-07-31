import type { User } from "./user.types";

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  user: User;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = LoginRequest & {
  name: string;
};
