// Central definitions for customer fields and image evidence slots.
// Keep this in sync with the DB columns in supabase/migrations.

export type FieldType = "text" | "date" | "number" | "textarea";

export interface CustomerFieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  /** Width hint for the responsive form grid. */
  span?: 1 | 2;
}

// Customer information captured per installation (matches the paper form).
export const CUSTOMER_FIELDS: CustomerFieldDef[] = [
  { key: "customer_name", label: "Customer Name", type: "text", required: true, span: 1 },
  { key: "order_number", label: "Order Number", type: "text", required: true, span: 1 },
  { key: "date_order_received", label: "Date Order Received", type: "date", span: 1 },
  { key: "date_installation", label: "Date Installation Activity", type: "date", span: 1 },
  { key: "msisdn", label: "MSISDN", type: "text", span: 1 },
  { key: "fttx_number", label: "FTTX Number", type: "text", span: 1 },
  { key: "customer_phone", label: "Customer Phone Details", type: "text", span: 1 },
  { key: "customer_address", label: "Customer Address", type: "textarea", span: 2 },
  { key: "gps_address", label: "GPS Address", type: "text", span: 2 },
  { key: "gps_lat", label: "GPS Latitude", type: "text", span: 1 },
  { key: "gps_lng", label: "GPS Longitude", type: "text", span: 1 },
  { key: "device_serial", label: "S/N - Installed Device", type: "text", span: 1 },
  { key: "network_type", label: "Network Type", type: "text", placeholder: "e.g. Quick ODN", span: 1 },
  { key: "network_box_id", label: "Network Box ID", type: "text", span: 1 },
  { key: "atb_power_readings", label: "ATB Power Readings", type: "text", span: 1 },
  { key: "cable_length", label: "Cable Length", type: "text", span: 1 },
  { key: "dead_end", label: "Dead End", type: "text", span: 1 },
];

export const INSTALLATION_STATUSES = [
  "Pending",
  "In Progress",
  "Good",
  "Failed",
  "Rework",
] as const;

export type InstallationStatus = (typeof INSTALLATION_STATUSES)[number];

// Fixed labeled photo slots (matches the evidence categories on the form).
export interface ImageSlotDef {
  key: string;
  label: string;
  description?: string;
}

export const IMAGE_SLOTS: ImageSlotDef[] = [
  { key: "client_serving_fat", label: "Client Serving FAT", description: "Home pass cable in view & other cables" },
  { key: "serving_fat_inside", label: "Inside View of Serving FAT", description: "Splitter / existing connections" },
  { key: "before_installation", label: "Before Installation" },
  { key: "after_installation", label: "After Installation" },
  { key: "anchoring_point", label: "Anchoring Point at Customer Premises" },
  { key: "drop_cable_dressing", label: "Drop Cable Dressing", description: "Within customer room" },
  { key: "atb_patch_cord", label: "ATB / Drop / Patch Cord", description: "After installation" },
  { key: "ont_installed", label: "ONT Installed and Plugged" },
  { key: "cable_entry_point", label: "Cable Entry Point", description: "Entry point of the cable to the customer's room" },
  { key: "installer_ppe_pole", label: "Installer on Pole with PPE", description: "Working on pole wearing all correct PPE" },
  { key: "power_meter_reading", label: "Power Meter Reading" },
  { key: "cable_swing_overview", label: "Cable Swing Overview", description: "Cable swing to customer's compound" },
  { key: "acceptance_form", label: "Acceptance Form" },
];

export const IMAGE_SLOT_LABELS: Record<string, string> = Object.fromEntries(
  IMAGE_SLOTS.map((s) => [s.key, s.label])
);

export const STORAGE_BUCKET = "installation-images";
export const REPORTS_BUCKET = "reports";
