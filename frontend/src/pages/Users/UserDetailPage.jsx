import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAsync } from "../../hooks";
import { UserService } from "../../services";
import { Loading, ErrorDisplay } from "../../components";

/**
 * UserDetailPage — Displays details for a single user.
 */
export function UserDetailPage() {
  const { id } = useParams();
  const { data, loading, error, execute } = useAsync(() => UserService.getById(id));

  useEffect(() => {
    execute();
  }, [execute]);

  if (loading) return <Loading />;
  if (error) return <ErrorDisplay error={error} onRetry={execute} />;

  const user = data?.data;

  return (
    <section>
      <h1>User Detail</h1>
      {user && (
        <div>
          <p>{user.name}</p>
          <p>{user.email}</p>
        </div>
      )}
    </section>
  );
}
