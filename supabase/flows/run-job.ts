import { Flow } from "@pgflow/dsl";
import { runJobStep } from "../tasks/runJobStep.ts";

type Input = {
  jobId: string;
};

export const RunJob = new Flow<Input>({
  slug: "runJob",
  maxAttempts: 1,
  timeout: 180,
  baseDelay: 5,
})
  .step(
    {
      slug: "execute",
      maxAttempts: 1,
      timeout: 180,
    },
    async (input) => {
      return await runJobStep(input);
    },
  );
