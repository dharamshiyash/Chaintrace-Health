import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const networkName = hre.globalOptions.network ?? "localhost";
  console.log(`Deploying ChainTraceHealth to ${networkName}...\n`);
  const network = await hre.network.connect(networkName);
  const ethers = network.ethers;

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "MATIC\n");

  const ChainTraceHealth = await ethers.getContractFactory("ChainTraceHealth");

  const startTime = Date.now();
  const contract = await ChainTraceHealth.deploy();
  const deployTx = contract.deploymentTransaction();

  console.log("Transaction hash:", deployTx.hash);
  console.log("Waiting for confirmation...");

  await contract.waitForDeployment();
  const confirmationTime = Date.now() - startTime;

  const address = await contract.getAddress();
  const receipt = await deployTx.wait();

  console.log("\n✓ Contract deployed successfully");
  console.log("  Address:           ", address);
  console.log("  Block:             ", receipt.blockNumber);
  console.log("  Gas used:          ", receipt.gasUsed.toString());
  console.log("  Confirmation time: ", confirmationTime, "ms");

  // Write deployment info
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentInfo = {
    network: networkName,
    chainId: 80002,
    contractAddress: address,
    deployer: deployer.address,
    txHash: deployTx.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    confirmationMs: confirmationTime,
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.join(deploymentsDir, `${networkName}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n✓ Deployment info written to deployments/${networkName}.json`);

  // Copy ABI for use by API
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/ChainTraceHealth.sol/ChainTraceHealth.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const abiPath = path.join(deploymentsDir, "ChainTraceHealth.abi.json");
  fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
  console.log("✓ ABI written to deployments/ChainTraceHealth.abi.json");

  console.log(`\nNext step: verify the contract on Polygonscan:`);
  console.log(`  npx hardhat verify --network ${networkName} ${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
