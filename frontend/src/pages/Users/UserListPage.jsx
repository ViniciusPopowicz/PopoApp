import { useEffect } from "react";
import { useAsync } from "../../hooks";
import { UserService } from "../../services";
import { Loading, ErrorDisplay } from "../../components";

/**
 * UserListPage — Displays a list of users.
 *
 * Demonstrates the standard page pattern:
 *   1. Use a hook (useAsync) to manage async state.
 *   2. Call the service layer on mount.
 *   3. Render with Loading/Error/Data states.
 */
export function UserListPage() {
  const { data, loading, error, execute } = useAsync(UserService.getAll);

  useEffect(() => {
    execute({ page: 1, limit: 20 });
  }, [execute]);

  if (loading) return <Loading />;
  if (error) return <ErrorDisplay error={error} onRetry={() => execute({ page: 1, limit: 20 })} />;

  return (
    <section>
      <h1>Users</h1>
      {data?.data?.users && (
        <ul>
          {data.data.users.map((user) => (
            <li key={user.id}>{user.name}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
