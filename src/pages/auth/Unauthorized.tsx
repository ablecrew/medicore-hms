export default function Unauthorized() {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-red-500">
          Access Denied
        </h1>
        <p className="text-slate-500">
          You do not have permission to access this module.
        </p>
      </div>
    </div>
  );
}