-- =============================================
-- Blood Test Appointment Booking System
-- =============================================
-- Adds appointment scheduling capabilities for blood test services
-- Including nurse availability slots, appointment booking, and home service addresses

-- =============================================
-- Create appointment_slots table FIRST
-- =============================================
-- Tracks available time slots for blood test appointments
-- Nurses populate this table to indicate their availability
CREATE TABLE IF NOT EXISTS public.appointment_slots (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nurse_id uuid NOT NULL,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  capacity integer NOT NULL DEFAULT 1,
  booked_count integer NOT NULL DEFAULT 0,
  region text NOT NULL DEFAULT 'Asia/Manila'::text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT appointment_slots_pkey PRIMARY KEY (id),
  CONSTRAINT appointment_slots_nurse_id_fkey FOREIGN KEY (nurse_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT appointment_slots_capacity_positive CHECK (capacity > 0),
  CONSTRAINT appointment_slots_booked_count_valid CHECK (booked_count >= 0 AND booked_count <= capacity),
  CONSTRAINT appointment_slots_time_valid CHECK (start_time < end_time),
  CONSTRAINT appointment_slots_region_check CHECK (region = 'Asia/Manila'::text)
);

-- Create unique constraint for slot uniqueness per date/time/nurse
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_slots_unique ON public.appointment_slots(date, start_time, end_time, nurse_id) WHERE is_active;

-- Create indexes for availability queries
CREATE INDEX IF NOT EXISTS idx_appointment_slots_date ON public.appointment_slots(date);
CREATE INDEX IF NOT EXISTS idx_appointment_slots_nurse_id ON public.appointment_slots(nurse_id);
CREATE INDEX IF NOT EXISTS idx_appointment_slots_active ON public.appointment_slots(is_active);

-- =============================================
-- Alter lab_orders table to add appointment fields
-- =============================================
ALTER TABLE public.lab_orders
ADD COLUMN IF NOT EXISTS appointment_slot_id uuid,
ADD COLUMN IF NOT EXISTS nurse_id uuid,
ADD COLUMN IF NOT EXISTS service_type text CHECK (service_type IS NULL OR service_type = ANY (ARRAY['lab'::text, 'home'::text])),
ADD COLUMN IF NOT EXISTS appointment_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS booking_status text DEFAULT 'PENDING'::text CHECK (booking_status = ANY (ARRAY['PENDING'::text, 'CONFIRMED'::text, 'COMPLETED'::text, 'CANCELLED'::text]));

-- Add foreign key constraints to lab_orders (after appointment_slots exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lab_orders_appointment_slot_id_fkey'
  ) THEN
    ALTER TABLE public.lab_orders
    ADD CONSTRAINT lab_orders_appointment_slot_id_fkey FOREIGN KEY (appointment_slot_id) REFERENCES public.appointment_slots(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lab_orders_nurse_id_fkey'
  ) THEN
    ALTER TABLE public.lab_orders
    ADD CONSTRAINT lab_orders_nurse_id_fkey FOREIGN KEY (nurse_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for appointment queries
CREATE INDEX IF NOT EXISTS idx_lab_orders_appointment_date ON public.lab_orders(appointment_date DESC);
CREATE INDEX IF NOT EXISTS idx_lab_orders_booking_status ON public.lab_orders(booking_status);
CREATE INDEX IF NOT EXISTS idx_lab_orders_nurse_id ON public.lab_orders(nurse_id);

-- =============================================
-- Create appointment_addresses table
-- =============================================
-- Stores home service addresses for blood test appointments
CREATE TABLE IF NOT EXISTS public.appointment_addresses (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lab_order_id uuid NOT NULL,
  name text NOT NULL,
  street text NOT NULL,
  city text NOT NULL,
  region text NOT NULL,
  country text NOT NULL DEFAULT 'Philippines'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT appointment_addresses_pkey PRIMARY KEY (id),
  CONSTRAINT appointment_addresses_lab_order_id_fkey FOREIGN KEY (lab_order_id) REFERENCES public.lab_orders(id) ON DELETE CASCADE,
  CONSTRAINT appointment_addresses_lab_order_id_unique UNIQUE (lab_order_id)
);

-- Create index for address lookups
CREATE INDEX IF NOT EXISTS idx_appointment_addresses_lab_order_id ON public.appointment_addresses(lab_order_id);

-- =============================================
-- RLS Policies
-- =============================================

-- Enable RLS on new tables
ALTER TABLE public.appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_addresses ENABLE ROW LEVEL SECURITY;

-- appointment_slots: Admins can view/manage all, nurses can view/create their own, patients can view available
CREATE POLICY "appointment_slots_admin_full_access" ON public.appointment_slots
  FOR ALL USING ((SELECT auth.jwt() ->> 'role')::text = 'admin');

CREATE POLICY "appointment_slots_nurse_own_access" ON public.appointment_slots
  FOR ALL USING (nurse_id = (SELECT auth.uid())
    AND (SELECT (raw_user_meta_data->>'role')::text FROM auth.users WHERE id = auth.uid()) = 'doctor');

CREATE POLICY "appointment_slots_public_read" ON public.appointment_slots
  FOR SELECT USING (is_active = true);

-- appointment_addresses: Only admins and associated patient can access
CREATE POLICY "appointment_addresses_admin_full" ON public.appointment_addresses
  FOR ALL USING ((SELECT auth.jwt() ->> 'role')::text = 'admin');

CREATE POLICY "appointment_addresses_patient_read" ON public.appointment_addresses
  FOR SELECT USING (
    lab_order_id IN (
      SELECT id FROM public.lab_orders
      WHERE patient_id = (SELECT id FROM public.patients WHERE auth_user_id = auth.uid())
    )
  );
