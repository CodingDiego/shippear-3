import { Suspense } from "react";
import "./admin.css";
import { AdminNav, AdminNavList } from "./_components/admin-nav";
import { adminSesion } from "./_lib/guard";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
	return (
		<>
			<div className="wrap">
				<Suspense fallback={<AdminNavList />}>
					<NavSiAdmin />
				</Suspense>
			</div>
			{children}
		</>
	);
}

// The session read stays inside the boundary so the layout never blocks its pages.
async function NavSiAdmin() {
	return (await adminSesion()) ? (
		<Suspense fallback={<AdminNavList />}>
			<AdminNav />
		</Suspense>
	) : null;
}
