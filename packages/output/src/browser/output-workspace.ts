/********************************************************************************
 * Copyright (C) 2020 TypeFox and others.
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

import { injectable } from 'inversify';
import { MonacoWorkspace } from '@theia/monaco/lib/browser/monaco-workspace';
import { MonacoEditorModel } from '@theia/monaco/lib/browser/monaco-editor-model';
import { OutputUri } from '../common/output-uri';

@injectable()
export class OutputWorkspace extends MonacoWorkspace {

    protected openEditorIfDirty(model: MonacoEditorModel): void {
        if (OutputUri.is(model.uri.toString())) {
            // NOOP
            return;
        }
        super.openEditorIfDirty(model);
    }

}