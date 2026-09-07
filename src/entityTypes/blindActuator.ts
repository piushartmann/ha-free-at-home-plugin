import Entity from "../entity.js";
import type { ConnectionContext } from "../utils.js";
import type { HassEntity } from "home-assistant-js-websocket";
import { FreeAtHomeBlindActuatorChannel } from "@busch-jaeger/free-at-home";

export default class BlindActuatorEntity extends Entity {
    declare fhEntity: FreeAtHomeBlindActuatorChannel;

    position?: number;

    /*
     * Zielposition eines Befehls von free@home.
     *
     * Solange Home Assistant diese Position noch nicht erreicht hat,
     * werden Zwischenpositionen nicht zurück an free@home gemeldet.
     *
     * Dadurch springt die Anzeige in free@home während einer Fahrt
     * nicht kurz auf die vorherige Position zurück.
     */
    targetPosition?: number;

    /*
     * Manche Covers erreichen die gewünschte Position nicht exakt
     * auf das Prozent genau.
     *
     * Deshalb akzeptieren wir eine kleine Toleranz.
     */
    readonly targetTolerance = 2;

    constructor(entity: HassEntity, ctx: ConnectionContext) {
        super(entity, ctx);

        this.position =
            entity.attributes?.current_position as number | undefined;
    }

    async createFreeAtHomeEntities(
        ctx: ConnectionContext
    ): Promise<void> {
        this.fhEntity =
            await ctx.freeAtHome.createBlindDevice(
                this.nativeId,
                this.name
            );

        /*
         * free@home -> Home Assistant
         *
         * free@home:
         * 0 %   = offen / oben
         * 100 % = geschlossen / unten
         *
         * Home Assistant:
         * 0 %   = geschlossen
         * 100 % = offen
         *
         * Deshalb wird die Position invertiert.
         */
        this.fhEntity.on(
            "relativeValueChanged",
            async (value: number) => {
                const homeAssistantPosition = 100 - value;

                /*
                 * Zielposition merken.
                 *
                 * Während Home Assistant dieses Ziel anfährt,
                 * werden Positionsänderungen nicht wieder zurück
                 * an free@home gespiegelt.
                 */
                this.targetPosition = homeAssistantPosition;

                console.log(
                    `Blinds ${this.id} position changed from free@home ${value} % to Home Assistant ${homeAssistantPosition} %`
                );

                console.log(
                    `Blinds ${this.id} waiting for Home Assistant target position ${homeAssistantPosition} %`
                );

                const serviceData = {
                    type: "call_service",
                    domain: "cover",
                    service: "set_cover_position",
                    target: {
                        entity_id: this.id
                    },
                    service_data: {
                        position: homeAssistantPosition
                    }
                };

                ctx.hassConnection
                    .sendMessagePromise(serviceData)
                    .catch((err) => {
                        /*
                         * Wenn der Home-Assistant-Befehl fehlschlägt,
                         * darf die Rückmeldung nicht dauerhaft
                         * blockiert bleiben.
                         */
                        this.targetPosition = undefined;

                        console.error(
                            "Error sending blind position update for",
                            this.id,
                            ":",
                            err
                        );
                    });
            }
        );

        /*
         * Stop-Befehl free@home -> Home Assistant
         */
        this.fhEntity.on(
            "stopMovement",
            async () => {
                console.log(
                    `Blinds ${this.id} stop movement command received`
                );

                /*
                 * Bei STOP gilt die zuvor angeforderte Zielposition
                 * nicht mehr.
                 *
                 * Die nächste tatsächliche Position von HA darf daher
                 * wieder an free@home zurückgemeldet werden.
                 */
                this.targetPosition = undefined;

                const serviceData = {
                    type: "call_service",
                    domain: "cover",
                    service: "stop_cover",
                    target: {
                        entity_id: this.id
                    }
                };

                ctx.hassConnection
                    .sendMessagePromise(serviceData)
                    .catch((err) => {
                        console.warn(
                            "Error sending blind stop command for",
                            this.id,
                            ":",
                            err
                        );
                    });
            }
        );
    }

    /*
     * Prüft sowohl den HA-State als auch die aktuelle Position.
     */
    stateChanged(hassEntity: HassEntity): boolean {
        const newPosition =
            hassEntity.attributes?.current_position as
                number | undefined;

        return (
            this.state !== hassEntity.state ||
            this.position !== newPosition
        );
    }

    /*
     * Home Assistant -> free@home
     *
     * Auch in dieser Richtung wird invertiert:
     *
     * HA 0 %   -> free@home 100 %
     * HA 20 %  -> free@home 80 %
     * HA 80 %  -> free@home 20 %
     * HA 100 % -> free@home 0 %
     */
    updateFreeAtHomeEntities(hassEntity: HassEntity): void {
        this.state = hassEntity.state;

        this.position =
            hassEntity.attributes?.current_position as
                number | undefined;

        if (this.position === undefined) {
            return;
        }

        /*
         * Läuft gerade ein von free@home ausgelöster Positionsbefehl?
         */
        if (this.targetPosition !== undefined) {
            const difference = Math.abs(
                this.position - this.targetPosition
            );

            /*
             * Ziel noch nicht erreicht:
             *
             * Keine Zwischenposition zurück an free@home melden.
             *
             * Beispiel:
             *
             * free@home fordert 80 %
             * -> HA-Ziel = 20 %
             *
             * HA meldet während der Fahrt:
             * 0 %, 5 %, 10 %, 15 %
             *
             * Diese Werte werden unterdrückt.
             */
            if (difference > this.targetTolerance) {
                console.log(
                    `Blinds ${this.id} suppressing intermediate Home Assistant position ${this.position} % while waiting for target ${this.targetPosition} %`
                );

                return;
            }

            /*
             * Ziel erreicht.
             *
             * Die Sperre wird aufgehoben und die tatsächlich
             * erreichte Position wird an free@home zurückgemeldet.
             */
            console.log(
                `Blinds ${this.id} reached target position: Home Assistant ${this.position} % (target ${this.targetPosition} %)`
            );

            this.targetPosition = undefined;
        }

        const freeAtHomePosition = 100 - this.position;

        console.log(
            `Publishing BlindActuatorChannel ${this.id} position: Home Assistant ${this.position} % -> free@home ${freeAtHomePosition} %`
        );

        this.fhEntity.delegatePositionChanged(
            freeAtHomePosition
        );
    }
}
