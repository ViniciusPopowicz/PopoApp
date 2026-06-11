import { useState, useCallback } from "react";

/**
 * Generic hook for managing async API operations.
 *
 * Provides:
 *   - data: the response data
 *   - loading: request in progress
 *   - error: error from the last request
 *   - execute: function to trigger the async operation
 *   - reset: clears data and error state
 *
 * Usage:
 *   const { data, loading, error, execute } = useAsync(UserService.getAll);
 *   useEffect(() => { execute({ page: 1, limit: 10 }); }, []);
 */
export function useAsync(asyncFn) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);

      try {
        const result = await asyncFn(...args);
        setData(result);
        return result;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [asyncFn]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}
