/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { inject, injectable, named } from 'inversify';
import { ContributionProvider } from '@theia/core/lib/common/contribution-provider';
import { TreeDecorator, AbstractTreeDecoratorService, TreeDecoration } from '@theia/core/lib/browser/tree/tree-decorator';
import { NavigatorTreeDecorator } from '../navigator-decorator-service';
import { Tree } from '@theia/core/lib/browser';

/**
 * Symbol for all decorators that would like to contribute into the navigator.
 */
export const OpenEditorsTreeDecorator = Symbol('OpenEditorsTreeDecorator');

/**
 * Decorator service for the navigator.
 */
@injectable()
export class OpenEditorsTreeDecoratorService extends AbstractTreeDecoratorService {

    constructor(@inject(ContributionProvider) @named(OpenEditorsTreeDecorator) protected readonly contributions: ContributionProvider<TreeDecorator>,
        @inject(ContributionProvider) @named(NavigatorTreeDecorator) protected readonly navigatorContributions: ContributionProvider<TreeDecorator>) {
        super([...contributions.getContributions(), ...navigatorContributions.getContributions()]);
    }

    async getDecorations(tree: Tree): Promise<Map<string, TreeDecoration.Data[]>> {
        const changes = new Map<string, TreeDecoration.Data[]>();
        const colorMap = new Map<string, string>();
        for (const decorator of this.decorators) {
            for (const [id, data] of (await decorator.decorations(tree)).entries()) {
                const colorFromIncomingData = data.fontData?.color;
                if (colorFromIncomingData) {
                    colorMap.set(id, colorFromIncomingData);
                }
                const color = colorMap.get(id) ?? data.fontData?.color;

                const existingDecorations = changes.get(id);
                if (existingDecorations) {
                    existingDecorations.push(data);
                    // iterate through existing decorations and add color to suffixes if they exist
                    const existingDecorationsWithColor = existingDecorations?.map(existingDec => {
                        if (existingDec.captionSuffixes) {
                            const captionSuffixCopy = existingDec.captionSuffixes.map(suffix => {
                                const fontData = { ...suffix.fontData, color };
                                return { ...suffix, fontData };
                            });
                            return { ...existingDec, captionSuffixes: captionSuffixCopy };
                        }
                        return existingDec;
                    });
                    changes.set(id, existingDecorationsWithColor);

                } else {
                    // if the decoration has suffixes, then colorize them
                    let dataCopy = data;
                    if (data.captionSuffixes) {
                        const captionSuffixCopy = data.captionSuffixes.map(suffix => {
                            const fontData = { ...suffix.fontData, color };
                            return { ...suffix, fontData };
                        });
                        dataCopy = { ...data, captionSuffixes: captionSuffixCopy };
                    }
                    changes.set(id, [dataCopy]);
                }
            }
        }
        return changes;
    }
}

// if we have color from the map, use that
// if we have color from the incoming, use that
