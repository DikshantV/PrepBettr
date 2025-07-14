import ResumeTailor from "@/components/ResumeTailor";
import { LuBrainCircuit } from "react-icons/lu";

export default function ResumeTailorPage() {
  return (
    <div className="w-full min-h-screen flex flex-col">
      <div className="flex-1 p-6 pb-24">
        <div className="flex items-center mb-6">
          <LuBrainCircuit className="text-3xl text-blue-400 mr-3" />
          <h1 className="text-3xl font-bold text-white">AI-Powered Resume Tailor</h1>
        </div>
        <ResumeTailor />
      </div>
    </div>
  );
}
