-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MEN', 'WOMEN', 'UNISEX');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('ADMIN', 'CUSTOMER', 'SYSTEM', 'ANONYMOUS');

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" VARCHAR(10),
    "dataPolicyAcceptedAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSession" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "family" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" VARCHAR(300),
    "ip" VARCHAR(45),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "family" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" VARCHAR(300),
    "ip" VARCHAR(45),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "gender" "Gender" NOT NULL,
    "price" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "brandId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductColor" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "hex" CHAR(7) NOT NULL,
    "code" VARCHAR(5) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductColor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" UUID NOT NULL,
    "productColorId" UUID NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "publicId" VARCHAR(200) NOT NULL,
    "alt" VARCHAR(150) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" UUID NOT NULL,
    "productColorId" UUID NOT NULL,
    "size" INTEGER NOT NULL,
    "sku" VARCHAR(30) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "salePrice" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" UUID NOT NULL,
    "tag" VARCHAR(24) NOT NULL,
    "title" VARCHAR(60) NOT NULL,
    "subtitle" VARCHAR(200) NOT NULL,
    "imageUrl" VARCHAR(500),
    "imagePublicId" VARCHAR(200),
    "ctaLabel" VARCHAR(30) NOT NULL,
    "ctaHref" VARCHAR(120) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" UUID,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    "recipientName" VARCHAR(80) NOT NULL,
    "phone" VARCHAR(10) NOT NULL,
    "department" VARCHAR(40) NOT NULL,
    "city" VARCHAR(60) NOT NULL,
    "line1" VARCHAR(120) NOT NULL,
    "notes" VARCHAR(120),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "customerId" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "subtotal" INTEGER NOT NULL,
    "shippingCost" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "shipRecipientName" VARCHAR(80) NOT NULL,
    "shipPhone" VARCHAR(10) NOT NULL,
    "shipDepartment" VARCHAR(40) NOT NULL,
    "shipCity" VARCHAR(60) NOT NULL,
    "shipLine1" VARCHAR(120) NOT NULL,
    "shipNotes" VARCHAR(120),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" VARCHAR(200),
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "listPrice" INTEGER NOT NULL,
    "productName" VARCHAR(80) NOT NULL,
    "colorName" VARCHAR(30) NOT NULL,
    "size" INTEGER NOT NULL,
    "sku" VARCHAR(30) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "reference" VARCHAR(40) NOT NULL,
    "wompiTransactionId" VARCHAR(64),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountInCents" INTEGER NOT NULL,
    "method" VARCHAR(30),
    "rawEvent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "adminId" UUID,
    "customerId" UUID,
    "action" VARCHAR(60) NOT NULL,
    "entity" VARCHAR(40),
    "entityId" VARCHAR(64),
    "details" JSONB,
    "ip" VARCHAR(45),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSession_tokenHash_key" ON "CustomerSession"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerSession_customerId_idx" ON "CustomerSession"("customerId");

-- CreateIndex
CREATE INDEX "CustomerSession_family_idx" ON "CustomerSession"("family");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_adminId_idx" ON "AdminSession"("adminId");

-- CreateIndex
CREATE INDEX "AdminSession_family_idx" ON "AdminSession"("family");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_reference_key" ON "Product"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_active_createdAt_idx" ON "Product"("active", "createdAt");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductColor_productId_code_key" ON "ProductColor"("productId", "code");

-- CreateIndex
CREATE INDEX "ProductImage_productColorId_sortOrder_idx" ON "ProductImage"("productColorId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Variant_sku_key" ON "Variant"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Variant_productColorId_size_key" ON "Variant"("productColorId", "size");

-- CreateIndex
CREATE INDEX "Offer_productId_active_startsAt_endsAt_idx" ON "Offer"("productId", "active", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Address_customerId_idx" ON "Address"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_customerId_variantId_key" ON "CartItem"("customerId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_expiresAt_idx" ON "Order"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_wompiTransactionId_key" ON "Payment"("wompiTransactionId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSession" ADD CONSTRAINT "CustomerSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductColor" ADD CONSTRAINT "ProductColor_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productColorId_fkey" FOREIGN KEY ("productColorId") REFERENCES "ProductColor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_productColorId_fkey" FOREIGN KEY ("productColorId") REFERENCES "ProductColor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ───────────── Restricciones que Prisma no genera (docs/03-modelo-datos.md) ─────────────

-- Búsqueda sin tildes en el catálogo.
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE "Product"  ADD CONSTRAINT "Product_price_check"   CHECK ("price" > 0 AND "price" <= 5000000);
ALTER TABLE "Variant"  ADD CONSTRAINT "Variant_stock_check"   CHECK ("stock" >= 0);
ALTER TABLE "Variant"  ADD CONSTRAINT "Variant_size_check"    CHECK ("size" BETWEEN 34 AND 48);
ALTER TABLE "ProductColor" ADD CONSTRAINT "ProductColor_hex_check" CHECK ("hex" ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE "Offer"    ADD CONSTRAINT "Offer_salePrice_check" CHECK ("salePrice" > 0);
ALTER TABLE "Offer"    ADD CONSTRAINT "Offer_dates_check"     CHECK ("endsAt" > "startsAt");
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_check" CHECK ("quantity" BETWEEN 1 AND 5);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_check" CHECK ("quantity" >= 1);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_prices_check" CHECK ("unitPrice" > 0 AND "listPrice" >= "unitPrice");
ALTER TABLE "Order"    ADD CONSTRAINT "Order_totals_check"    CHECK ("subtotal" >= 0 AND "shippingCost" >= 0 AND "total" = "subtotal" + "shippingCost");
ALTER TABLE "Payment"  ADD CONSTRAINT "Payment_amount_check"  CHECK ("amountInCents" > 0);

-- Un cliente solo puede tener una dirección predeterminada.
CREATE UNIQUE INDEX "Address_one_default_per_customer" ON "Address" ("customerId") WHERE "isDefault";
