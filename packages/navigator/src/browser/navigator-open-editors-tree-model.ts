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

import { injectable, inject, postConstruct } from 'inversify';
import { EditorManager } from '@theia/editor/lib/browser';
import { ApplicationShell, TreeModelImpl } from '@theia/core/lib/browser';

@injectable()
export class OpenEditorsModel extends TreeModelImpl {
    @inject(ApplicationShell) protected readonly applicationShell: ApplicationShell;
    @inject(EditorManager) protected readonly editorManager: EditorManager;

    @postConstruct()
    protected init(): void {
        super.init();
        this.toDispose.push(this.applicationShell.onDidAddWidget(widget => {
            console.log('SENTINEL WIDGET CHANGED', widget);
            console.log('SENTINEL ALL WIDGET', this, this.applicationShell.widgets);
        }));
        this.toDispose.push(this.applicationShell.onDidRemoveWidget(widget => {
            console.log('SENTINEL WIDGET CHANGED', widget);
            console.log('SENTINEL ALL WIDGET', this, this.applicationShell.widgets);
        }));
    }
}
