import { Router, type IRouter } from "express";
import healthRouter from "./health";
import botRouter from "./bot";
import authRouter, { requirePanelAuth } from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/bot", requirePanelAuth);
router.use(botRouter);

export default router;
