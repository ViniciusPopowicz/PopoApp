import { useState, useCallback } from "react";

/**
 * Hook for managing form state and validation.
 *
 * Provides:
 *   - values: current form values
 *   - errors: validation errors per field
 *   - handleChange: updates a field value
 *   - setFieldValue: programmatically set a specific field
 *   - validate: runs validation rules and returns validity
 *   - resetForm: resets to initial values
 *
 * Usage:
 *   const { values, errors, handleChange, validate, resetForm } = useForm(
 *     { name: "", email: "" },
 *     { name: (v) => v ? null : "Name is required" }
 *   );
 */
export function useForm(initialValues = {}, validationRules = {}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});

  const handleChange = useCallback((event) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  }, []);

  const setFieldValue = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  }, []);

  const validate = useCallback(() => {
    const newErrors = {};
    let isValid = true;

    Object.entries(validationRules).forEach(([field, rule]) => {
      const error = rule(values[field], values);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [values, validationRules]);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  return { values, errors, handleChange, setFieldValue, validate, resetForm };
}
