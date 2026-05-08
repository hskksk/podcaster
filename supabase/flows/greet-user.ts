import { Flow } from '@pgflow/dsl';

type Input = {
  firstName: string;
  lastName: string;
};

export const GreetUser = new Flow<Input>({
  slug: 'greetUser',
})
  .step(
    { slug: 'fullName' },
    (flowInput) => `${flowInput.firstName} ${flowInput.lastName}`
  )
  .step(
    { slug: 'greeting', dependsOn: ['fullName'] },
    (deps) => `Hello, ${deps.fullName}!`
  );
