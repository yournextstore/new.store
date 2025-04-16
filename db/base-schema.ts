import {
  type InferInsertModel,
  type InferSelectModel,
  relations,
  sql,
} from 'drizzle-orm';
import {
  type PgEnum,
  boolean,
  customType,
  decimal,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { v7 } from 'uuid';
import { organizations, users2s } from './auth-schema';

const uuidId = {
  id: uuid('id')
    .notNull()
    .primaryKey()
    .default(sql`uuid_generate_v7()`)
    .$defaultFn(() => v7()),
};

const customBigint = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'bigint';
  },
  toDriver(value) {
    return value.toString();
  },
  fromDriver(value) {
    return value.toString();
  },
});

const ltree = customType<{ data: string }>({
  dataType() {
    return 'ltree';
  },
});

const commonFields = {
  createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date().toISOString()),
} as const;

export const users = pgTable('users', {
  ...uuidId,
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull().unique(),

  ...commonFields,
});

export const usersRelations = relations(users, ({ many }) => ({
  stores: many(stores),
}));

export const StoreEnvironmentEnum = pgEnum('store_environment', [
  'live',
  'test',
]);
export const StoreTaxBehaviorEnum = pgEnum('store_tax_behavior', [
  'inclusive',
  'exclusive',
]);
export type StoreSelectModel = InferSelectModel<typeof stores>;
export const stores = pgTable('stores', {
  ...uuidId,
  userId: uuid('user_id').references(() => users.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),

  user2Id: text('user2_id').references(() => users2s.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),

  name: text('name').notNull().default('<Your Next Store>'),
  subdomain: text('subdomain').notNull().unique(),
  domain: text('domain').unique(),

  locale: text('locale').notNull().default('en-US'),
  currency: text('currency').notNull().default('USD'),
  taxBehavior: StoreTaxBehaviorEnum().notNull().default('inclusive'),

  clerkOrganizationId: text('clerk_organization_id').unique(),
  organizationId: text('organization_id')
    .unique()
    .references(() => organizations.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  stripeAccountId: text('stripe_account_id'),
  stripeCustomerId: text('stripe_customer_id').unique(),

  settings: jsonb('settings').notNull().default('{}'),
  flags: jsonb('flags').notNull().default('{}'),

  environment: StoreEnvironmentEnum().notNull().default('test'),

  subscribed: boolean('subscribed').notNull().default(false),
  stripeSubscriptionId: text('stripe_subscription_id'),

  addressId: uuid('address_id').references(() => addresses.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),

  ...commonFields,
});
export const storesRelations = relations(stores, ({ one, many }) => ({
  user: one(users, { references: [users.id], fields: [stores.userId] }),
  address: one(addresses, {
    references: [addresses.id],
    fields: [stores.addressId],
  }),
  pages: many(pages),
  shippings: many(shippings),
  coupons: many(coupons),
  carts: many(carts),
  orders: many(orders),
  products: many(products),
  collections: many(collections),
  categories: many(categories),
  addons: many(addons),
  customers: many(customers),
  pickups: many(pickups),
  taxRates: many(taxRates),
  agreements: many(agreements),
  organization: one(organizations, {
    references: [organizations.id],
    fields: [stores.organizationId],
  }),
}));

export const pages = pgTable(
  'pages',
  {
    ...uuidId,
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    path: text('path').notNull(),
    config: jsonb('config').notNull(),

    ...commonFields,
  },
  (t) => [unique('pages__store_id__path__unique').on(t.storeId, t.path)],
);
export const pagesRelations = relations(pages, ({ one }) => ({
  store: one(stores, { references: [stores.id], fields: [pages.storeId] }),
}));

export const reviews = pgTable('reviews', {
  ...uuidId,
  storeId: uuid('store_id')
    .notNull()
    .references(() => stores.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  author: text('author').notNull(),
  email: text('email').notNull(),
  content: text('content').notNull(),
  rating: integer('rating').notNull(),
  ...commonFields,
});
export const reviewsRelations = relations(reviews, ({ one }) => ({
  store: one(stores, { references: [stores.id], fields: [reviews.storeId] }),
}));

export const collections = pgTable(
  'collections',
  {
    ...uuidId,

    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    image: text('image'),

    ...commonFields,
  },
  (t) => [
    unique('collections__store_id__slug__unique').on(t.storeId, t.slug),
    index('collections__slug__idx').on(t.slug),
  ],
);
export const collectionsRelations = relations(collections, ({ one, many }) => ({
  store: one(stores, {
    references: [stores.id],
    fields: [collections.storeId],
  }),
  productCollections: many(productCollection),
}));

export const pageSectionData = pgTable(
  'page_section_data',
  {
    ...uuidId,

    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    productId: text('product_id').notNull(),
    // references to the section in the product page
    // is not unique because the same section is in multiple products
    pageSectionPointer: serial('page_section_pointer').notNull(),
    content: jsonb('content').notNull(),

    ...commonFields,
  },
  (t) => [
    index('psd__store_id__stripe_product_id__index').on(t.storeId, t.productId),
    unique('psd__stripe_product_id__page_section_pointer__unique').on(
      t.productId,
      t.pageSectionPointer,
    ),
  ],
);
export const pageSectionsRelations = relations(pageSectionData, ({ one }) => ({
  store: one(stores, {
    references: [stores.id],
    fields: [pageSectionData.storeId],
  }),
}));

export const questions = pgTable('questions', {
  ...uuidId,
  storeId: uuid('store_id')
    .notNull()
    .references(() => stores.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  productId: text('product_id').notNull(),
  author: text('author').notNull(),
  email: text('email').notNull(),
  question: text('question').notNull(),
  answers: jsonb('answers').notNull().default('[]'),

  ...commonFields,
});
export const questionsRelations = relations(questions, ({ one }) => ({
  store: one(stores, { references: [stores.id], fields: [questions.storeId] }),
}));

// --- Products stored in our database

export const products = pgTable(
  'products',
  {
    ...uuidId,

    name: text('name').notNull(),
    slug: text('slug').notNull(),
    summary: text('summary'),
    // fallback images if not defined per variant
    images: text('images').array().notNull().default([]),
    shippable: boolean('shippable').notNull().default(true),
    active: boolean('active').default(true),
    position: integer('position').notNull().default(0),
    badge: jsonb('badge').notNull().default('{}'),

    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    ...commonFields,
  },
  (t) => [
    unique('products__store_id__slug__unique').on(t.storeId, t.slug),
    index('products__name__gin').using('gin', sql`${t.name} gin_trgm_ops`),
    index('products__summary__gin').using(
      'gin',
      sql`${t.summary} gin_trgm_ops`,
    ),
  ],
);
export const productsRelations = relations(products, ({ one, many }) => ({
  store: one(stores, { references: [stores.id], fields: [products.storeId] }),
  variants: many(productVariants),
  variantsTypes: many(variantTypes),
  productCollections: many(productCollection),
  productCategories: many(productCategory),
  productTaxRate: one(productsTaxRates),
}));

export const productCollection = pgTable(
  'product_collection',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.collectionId] })],
);
export const productCollectionRelations = relations(
  productCollection,
  ({ one }) => ({
    product: one(products, {
      fields: [productCollection.productId],
      references: [products.id],
    }),
    collection: one(collections, {
      fields: [productCollection.collectionId],
      references: [collections.id],
    }),
  }),
);

export const variantTypes = pgTable(
  'variant_types',
  {
    ...uuidId,

    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    label: text('label').notNull(),

    ...commonFields,
  },
  (t) => [
    unique('variants__product_id__label__unique').on(t.productId, t.label),
  ],
);
export const variantTypesRelations = relations(
  variantTypes,
  ({ one, many }) => ({
    product: one(products, {
      references: [products.id],
      fields: [variantTypes.productId],
    }),
    variantValues: many(variantValues),
  }),
);

export const variantValues = pgTable(
  'variant_values',
  {
    ...uuidId,

    variantTypeId: uuid('variant_type_id')
      .notNull()
      .references(() => variantTypes.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    value: text('value').notNull(),
  },
  (t) => [
    unique('variant_values__variant_type_id__value__unique').on(
      t.variantTypeId,
      t.value,
    ),
  ],
);
export const variantValuesRelations = relations(
  variantValues,
  ({ one, many }) => ({
    variantType: one(variantTypes, {
      references: [variantTypes.id],
      fields: [variantValues.variantTypeId],
    }),
    variantCombinations: many(variantCombinations),
  }),
);

export const productVariants = pgTable('product_variants', {
  ...uuidId,

  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  sku: text('sku'),

  width: decimal('width', { precision: 16, scale: 3, mode: 'number' }), // mm
  height: decimal('height', { precision: 16, scale: 3, mode: 'number' }), // mm
  depth: decimal('depth', { precision: 16, scale: 3, mode: 'number' }), // mm

  weight: decimal('weight', { precision: 16, scale: 3, mode: 'number' }), // grams

  price: customBigint('price', { mode: '' }).notNull(),
  calculatedPrice: customBigint('calculated_price', { mode: '' }),

  images: text('images').array().notNull().default([]),
  digital: text('digital').array(),

  // TODO maybe in the future stock per many locations
  stock: integer('stock'),

  ...commonFields,
});
export const productVariantsRelations = relations(
  productVariants,
  ({ one, many }) => ({
    product: one(products, {
      references: [products.id],
      fields: [productVariants.productId],
    }),
    combinations: many(variantCombinations),
  }),
);

export const variantCombinations = pgTable(
  'variant_combinations',
  {
    productVariantId: uuid('product_variant_id')
      .notNull()
      .references(() => productVariants.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    variantValueId: uuid('variant_value_id')
      .notNull()
      .references(() => variantValues.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    ...commonFields,
  },
  (t) => [primaryKey({ columns: [t.productVariantId, t.variantValueId] })],
);
export const variantCombinationsRelations = relations(
  variantCombinations,
  ({ one }) => ({
    productVariant: one(productVariants, {
      references: [productVariants.id],
      fields: [variantCombinations.productVariantId],
    }),
    variantValue: one(variantValues, {
      references: [variantValues.id],
      fields: [variantCombinations.variantValueId],
    }),
  }),
);

// --- cart
export const carts = pgTable('carts', {
  ...uuidId,

  storeId: uuid('store_id')
    .notNull()
    .references(() => stores.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  customerId: uuid('customer_id').references(() => customers.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),

  stripePaymentIntentId: text('stripe_payment_intent_id').unique(),

  // tax ID ?

  shippingId: uuid('shipping_id').references(() => shippings.id, {
    onDelete: 'set null',
    onUpdate: 'set null',
  }),

  couponId: uuid('coupond_id').references(() => coupons.id, {
    onDelete: 'set null',
    onUpdate: 'set null',
  }),

  shippingAddressId: uuid('shipping_address_id').references(
    () => addresses.id,
    {
      onDelete: 'set null',
      onUpdate: 'set null',
    },
  ),

  billingAddressId: uuid('billing_address_id').references(() => addresses.id, {
    onDelete: 'set null',
    onUpdate: 'set null',
  }),

  addonData: jsonb('addon_data')
    .$type<Record<string, unknown> | undefined | null>()
    .notNull(),

  ...commonFields,
});
export const cartsRelations = relations(carts, ({ one, many }) => ({
  store: one(stores, { references: [stores.id], fields: [carts.storeId] }),
  lineItems: many(lineItems),
  shipping: one(shippings, {
    references: [shippings.id],
    fields: [carts.shippingId],
  }),
  shippingAddress: one(addresses, {
    references: [addresses.id],
    fields: [carts.shippingAddressId],
  }),
  billingAddress: one(addresses, {
    references: [addresses.id],
    fields: [carts.billingAddressId],
  }),
  customer: one(customers, {
    references: [customers.id],
    fields: [carts.customerId],
  }),
  coupon: one(coupons, { references: [coupons.id], fields: [carts.couponId] }),
}));

export const customers = pgTable(
  'customers',
  {
    ...uuidId,

    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    email: text('email').notNull(),

    ...commonFields,
  },
  (t) => [unique('customers__store_id__email__unique').on(t.storeId, t.email)],
);
export const customersRelations = relations(customers, ({ one, many }) => ({
  store: one(stores, { references: [stores.id], fields: [customers.storeId] }),
  carts: many(carts),
}));

export type OrderStatusEnum = typeof OrderStatusEnum extends PgEnum<infer R>
  ? R
  : never;
export const OrderStatusEnum = pgEnum('order_status', [
  'created',
  'paid',
  'processing',
  'shipped',
  'completed',
  'cancelled',
]);
export type OrderSelectModel = InferSelectModel<typeof orders>;
export const orders = pgTable(
  'orders',
  {
    ...uuidId,

    lookup: integer().notNull().default(0),

    environment: StoreEnvironmentEnum().notNull().default('test'),

    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    orderData: jsonb('order_data').notNull(),
    externalShipmentId: text(),
    status: OrderStatusEnum().notNull().default('created'),

    ...commonFields,
  },
  (t) => [
    index('orders__lookup__idx').on(t.lookup),
    index('orders__status__idx').on(t.status),
    index('orders__status__store_id__environment').on(t.storeId, t.environment),
  ],
);
export const ordersRelations = relations(orders, ({ one }) => ({
  store: one(stores, { references: [stores.id], fields: [orders.storeId] }),
}));

export const AddressTypeEnum = pgEnum('address_type', [
  'shipping',
  'billing',
  'merchant',
]);
export const addresses = pgTable('addresses', {
  ...uuidId,

  type: AddressTypeEnum().notNull(),

  company: text('company'),
  name: text('name'),
  city: text('city'),
  country: text('country'),
  line1: text('line1'),
  line2: text('line2'),
  postalCode: text('postal_code'),
  state: text('state'),
  phone: text('phone'),
  taxId: text('tax_id'),

  ...commonFields,
});
export const addressesRelations = relations(addresses, ({ one }) => ({
  cartShipping: one(carts, {
    references: [carts.shippingAddressId],
    fields: [addresses.id],
  }),
  cartBilling: one(carts, {
    references: [carts.billingAddressId],
    fields: [addresses.id],
  }),
  storeCompanyAddress: one(stores),
}));

export const pickups = pgTable('pickups', {
  ...uuidId,

  storeId: uuid('store_id'),

  label: text('label').notNull().default(''),

  company: text('company'),
  name: text('name').notNull(),
  city: text('city').notNull(),
  country: text('country').notNull(),
  line1: text('line1').notNull(),
  line2: text('line2'),
  postalCode: text('postal_code').notNull(),
  state: text('state'),
  phone: text('phone').notNull(),

  ...commonFields,
});
export const pickupsRelations = relations(pickups, ({ one }) => ({
  store: one(stores, { references: [stores.id], fields: [pickups.storeId] }),
}));

export const lineItems = pgTable(
  'line_items',
  {
    ...uuidId,

    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    productVariantId: uuid('product_variant_id')
      .notNull()
      .references(() => productVariants.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    quantity: integer('quantity').notNull().default(1),

    ...commonFields,
  },
  (t) => [
    unique('line_items__cart_id__variant_id').on(t.cartId, t.productVariantId),
  ],
);
export const lineItemsRelations = relations(lineItems, ({ one }) => ({
  cart: one(carts, { references: [carts.id], fields: [lineItems.cartId] }),
  productVariant: one(productVariants, {
    references: [productVariants.id],
    fields: [lineItems.productVariantId],
  }),
}));

export type AddonSelectModel = InferSelectModel<typeof addons>;
export const AddonTypeEnum = pgEnum('addon_type', ['shipping']);
export type AddonsInsertModel = InferInsertModel<typeof addons>;
export const addons = pgTable(
  'addons',
  {
    ...uuidId,

    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    name: text('name').notNull(),
    type: AddonTypeEnum().notNull(),
    settings: jsonb('settings').notNull().default('{}'),

    ...commonFields,
  },
  (t) => [unique('unique__store_id__name').on(t.storeId, t.name)],
);
export const addonsRelations = relations(addons, ({ many }) => ({
  shippings: many(shippings),
}));

export const shippings = pgTable('shipping', {
  ...uuidId,

  storeId: uuid('store_id')
    .notNull()
    .references(() => stores.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  name: text('name').notNull(),
  price: customBigint('price', { mode: 'bigint' }).notNull(),
  minShippingTime: integer('min_shipping_time').notNull(),
  maxShippingTime: integer('max_shipping_time').notNull(),

  addonId: uuid('addon_id').references(() => addons.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),

  ...commonFields,
});
export const shippingsRelations = relations(shippings, ({ one }) => ({
  shippingAddon: one(addons, {
    references: [addons.id],
    fields: [shippings.addonId],
  }),
  shippingTaxRate: one(shippingsTaxRates),
}));

export const categories = pgTable(
  'category',
  {
    ...uuidId,
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    storeId: uuid('store_id').references(() => stores.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    parentId: uuid('parent_id'),
    path: ltree('path').notNull(),
    position: integer('position').notNull().default(0),
    active: boolean('active').notNull().default(true),
    ...commonFields,
  },
  (t) => [
    unique('categories__store_id__slug').on(t.storeId, t.slug),
    foreignKey({ columns: [t.parentId], foreignColumns: [t.id] })
      .onDelete('cascade')
      .onUpdate('cascade'),
  ],
);
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    references: [categories.id],
    fields: [categories.parentId],
  }),
  children: many(categories),
  productCategory: many(productCategory),
}));

export const productCategory = pgTable(
  'product_category',
  {
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    primary: boolean('primary').notNull().default(false),
    position: integer('position').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.categoryId, t.productId] }),
    index('idx_product_category').on(t.productId, t.categoryId),
    index('idx_position').on(t.position),
  ],
);
export const productCategoryRelations = relations(
  productCategory,
  ({ one }) => ({
    product: one(products, {
      fields: [productCategory.productId],
      references: [products.id],
    }),
    category: one(categories, {
      fields: [productCategory.categoryId],
      references: [categories.id],
    }),
  }),
);

export const CouponTypeEnum = pgEnum('coupon_type', ['percentage', 'fixed']);
export const coupons = pgTable('coupons', {
  ...uuidId,

  code: text('code').notNull(),
  timesRedeemed: integer('times_redeemed').notNull().default(0),
  type: CouponTypeEnum().notNull(),

  // @fixme a bug: when percentage is stored, the value is multiplied depending on the store currency. It should not be – it should always be a percentage.
  value: customBigint('value', { mode: 'bigint' }).notNull(),

  startDate: timestamp('start_date', { mode: 'string', withTimezone: true }),
  endDate: timestamp('end_date', { mode: 'string', withTimezone: true }),

  storeId: uuid('store_id')
    .notNull()
    .references(() => stores.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  ...commonFields,
});

export const couponsRelations = relations(coupons, ({ one, many }) => ({
  store: one(stores, { references: [stores.id], fields: [coupons.storeId] }),
  couponsProducts: many(couponsProducts),
}));

export const couponsProducts = pgTable(
  'coupons_products',
  {
    couponId: uuid('coupon_id')
      .notNull()
      .references(() => coupons.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    ...commonFields,
  },
  (t) => [primaryKey({ columns: [t.couponId, t.productId] })],
);

export const agreements = pgTable('agreements', {
  ...uuidId,

  storeId: uuid('store_id')
    .notNull()
    .references(() => stores.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  label: text('label').notNull(),
  required: boolean('required').notNull(),
  position: text('position').notNull(),

  ...commonFields,
});

export const agreementsRelations = relations(agreements, ({ one }) => ({
  store: one(stores, { references: [stores.id], fields: [agreements.storeId] }),
}));

export const taxRates = pgTable('tax_rates', {
  ...uuidId,

  storeId: uuid('store_id')
    .notNull()
    .references(() => stores.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  name: text('name').notNull(),
  rate: customBigint('value', { mode: 'bigint' }).notNull(),

  ...commonFields,
});
export const taxRatesRelations = relations(taxRates, ({ one, many }) => ({
  store: one(stores, { references: [stores.id], fields: [taxRates.storeId] }),
  productsTaxRates: many(productsTaxRates),
  shippingsTaxRates: many(shippingsTaxRates),
}));

export const productsTaxRates = pgTable(
  'products_tax_rates',
  {
    taxRateId: uuid('tax_rate_id')
      .notNull()
      .references(() => taxRates.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    ...commonFields,
  },
  (t) => [primaryKey({ columns: [t.taxRateId, t.productId] })],
);
export const productsTaxRatesRelations = relations(
  productsTaxRates,
  ({ one }) => ({
    product: one(products, {
      references: [products.id],
      fields: [productsTaxRates.productId],
    }),
    taxRate: one(taxRates, {
      references: [taxRates.id],
      fields: [productsTaxRates.taxRateId],
    }),
  }),
);

export const shippingsTaxRates = pgTable(
  'shippings_tax_rates',
  {
    taxRateId: uuid('tax_rate_id')
      .notNull()
      .references(() => taxRates.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    shippingId: uuid('shipping_id')
      .notNull()
      .references(() => shippings.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    ...commonFields,
  },
  (t) => [primaryKey({ columns: [t.taxRateId, t.shippingId] })],
);
export const shippingsTaxRatesRelations = relations(
  shippingsTaxRates,
  ({ one }) => ({
    shipping: one(shippings, {
      references: [shippings.id],
      fields: [shippingsTaxRates.shippingId],
    }),
    taxRate: one(taxRates, {
      references: [taxRates.id],
      fields: [shippingsTaxRates.taxRateId],
    }),
  }),
);
export const posts = pgTable(
  'posts',
  {
    ...uuidId,

    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    title: text('title').notNull(),
    slug: text('slug').notNull(),
    content: text('content'),

    ...commonFields,
  },
  (t) => [unique('posts__store_id__slug__unique').on(t.storeId, t.slug)],
);
export const postsRelations = relations(posts, ({ one }) => ({
  store: one(stores, { references: [stores.id], fields: [posts.storeId] }),
}));
