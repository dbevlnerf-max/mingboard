import AppTopBar from "@/app/components/AppTopBar";


export default function AdminLayout({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <>
      <AppTopBar />
      {children}
    </>
  );
}
