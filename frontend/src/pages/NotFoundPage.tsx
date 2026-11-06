import { Link } from "react-router-dom";
import { Card, PageHeader } from "../components/ui";

export default function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" description="The page you requested does not exist." />
      <Card className="px-6 py-10 text-center">
        <p className="text-[13px] text-muted">
          Return to the{" "}
          <Link to="/" className="font-medium text-accent hover:text-accent-dark">
            overview dashboard
          </Link>
          .
        </p>
      </Card>
    </>
  );
}
