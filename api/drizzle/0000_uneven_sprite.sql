CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"password" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
