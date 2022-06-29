// *****************************************************************************
// Copyright (C) 2022 Ericsson and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
// *****************************************************************************

import { injectable } from '@theia/core/shared/inversify';
import { AbstractViewContribution } from '@theia/core/lib/browser';
import { TerminalManagerWidget } from './terminal-manager-widget';
import { Command, CommandContribution, CommandRegistry } from '@theia/core';

const GET_SIZES: Command = {
    id: 'terminal-manager-get-layout',
    label: 'TerminalManager: Get Layout Data',
};

@injectable()
export class TerminalManagerFrontendViewContribution extends AbstractViewContribution<TerminalManagerWidget>
    implements CommandContribution {
    constructor() {
        super({
            widgetId: TerminalManagerWidget.ID,
            widgetName: 'Sample Unclosable View',
            toggleCommandId: 'terminalManager:toggle',
            defaultWidgetOptions: {
                area: 'bottom'
            }
        });
    }

    override registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
        commands.registerCommand(GET_SIZES, {
            execute: () => this.tryGetWidget()?.getLayoutData(),
        });
    }
}