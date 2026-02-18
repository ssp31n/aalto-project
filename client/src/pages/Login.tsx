import { useNavigate } from "react-router-dom";
import { PlaneIcon } from "../components/ui/icons";
import { useAuth } from "../contexts/AuthContext";

const Login = () => {
  const { signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      navigate("/plan");
    } catch (error) {
      console.error("Login failed", error);
      alert("Login failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-600">
          <PlaneIcon className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-semibold text-slate-900">TripFlow</h1>
        <p className="mt-2 text-sm text-slate-600">Smarter routes for every day of your trip</p>

        <button
          type="button"
          onClick={handleLogin}
          className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="h-5 w-5"
          />
          Continue with Google
        </button>
      </div>
    </div>
  );
};

export default Login;
