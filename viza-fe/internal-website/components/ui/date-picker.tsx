"use client";

import {
  ApplicationFormDatePicker,
  type ApplicationFormDatePickerProps,
} from "@/components/ui/application-form-date-picker";

type DatePickerProps = ApplicationFormDatePickerProps;

function DatePicker(props: DatePickerProps) {
  return <ApplicationFormDatePicker {...props} />;
}

export { DatePicker, type DatePickerProps };
