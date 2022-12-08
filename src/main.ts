import { ModelRenderer } from "./ModelRenderer";

const container = document.getElementById("container") as HTMLDivElement;
const modelRenderer = new ModelRenderer(container);
// await modelRenderer.load("00157061-dfed-48e7-8c4c-f22477d43ae3");
await modelRenderer.load("0948c2cb-8819-4c27-9e04-2c550ccb9f0d");
