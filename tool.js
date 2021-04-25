let INPUT_TEXT = null; // InputTextクラスのインスタンス
let TABLE_MAP = new Map(); // 入力ファイルパース後のTableクラスを持つ
let EXECUTED_FLAG = false; // 「3.Javaコード生成」のボタンが押されるとtrueになる

/*
 * 入力ファイルの内容を持つクラス
 */
class InputText {
    text = []; // 内容はスペースで分割した配列で持つ
    index = 0;

    constructor(text) {
        this.text = text.replace(/\r?\n/g, ' ').replace('\t', ' ').replace('\r', ' ').split(' ');
    }

    next() {
        if (this.text.length <= this.index) return '';
        return this.text[this.index++];
    }

    hasNext() {
        if (this.index < this.text.length - 1) return true;
        else return false;
    }
}

/*
 * テーブルの情報を持つクラス
 */
class Table {
    name = ''; // テーブル名
    references = []; // Rerefenceクラスの配列

    constructor(name) {
        this.name = name;
    }
}

/*
 * 外部キーの情報を持つクラス
 */
class Reference {
    tableName = ''; // 参照元テーブル名
    columns = []; // 参照元列名
    refTableName = ''; // 参照先テーブル名
    refColumns = []; // 参照先列名

    constructor(tableName, columns, refTableName, refColumns) {
        this.tableName = tableName;
        this.columns = columns;
        this.refTableName = refTableName;
        this.refColumns = refColumns;
    }
}

/*
 * デバッグ用関数
 */
function showForEach(objs) {
    objs.forEach(obj => {
        console.log(obj);
    });
}

/*
 * ページ表示時に呼ばれる関数
 */
function init() {
    // ファイルを開くボタンのイベント
    document.getElementById("ddlFile").addEventListener("change", openFile);
}

/*
 * ファイルを開く関数
 */
function openFile(evt) {
    let file = evt.target.files[0];
    let reader = new FileReader();
    reader.readAsText(file);
    reader.onload = evt => {
        parse(evt.target.result);
    };
}

function removeBackQuote(name) {
    if (name.charAt(0) == '`' && name.charAt(name.length - 1) == '`') {
        return name.slice(1, name.length - 1);
    }
    return name;
}

/*
 * ALTER文かCONSTRAINT句のFOREIGN KEYをパースする関数
 * 引数のTableオブジェクトのreferenceを追加する
 *
 * 文法は以下
 * FOREIGN KEY (<column>, <column> ...)
 * REFERENCES <refTableName> (<refColumn>, <refColumn> ...)
 */
function parseForeignKey(table) {
    let columns = [];
    while (INPUT_TEXT.hasNext()) {
        word = INPUT_TEXT.next();
        if (word.indexOf('(') != -1) {
            word = word.slice(1);
        }
        if (word.indexOf(',') != -1) {
            word = word.slice(0, word.indexOf(','));
        }
        if (word.indexOf(')') != -1) {
            word = word.slice(0, word.indexOf(')'));
            columns.push(removeBackQuote(word));
            break;
        }
        columns.push(removeBackQuote(word));
    }

    if (INPUT_TEXT.next().indexOf('REFERENCES') == -1) return;
    let refTableName = removeBackQuote(INPUT_TEXT.next());

    let refColumns = [];
    while (INPUT_TEXT.hasNext()) {
        word = INPUT_TEXT.next();
        if (word.indexOf('(') != -1) {
            word = word.slice(1);
        }
        if (word.indexOf(',') != -1) {
            word = word.slice(0, word.indexOf(','));
        }
        if (word.indexOf(')') != -1) {
            word = word.slice(0, word.indexOf(')'));
            refColumns.push(removeBackQuote(word));
            break;
        }
        refColumns.push(removeBackQuote(word));
    }

    reference = new Reference(table.name, columns, refTableName, refColumns);
    table.references.push(reference);
}

/*
 * CONSTRAINT句をパースする関数
 * 引数のTableオブジェクトのreferenceを追加する
 *
 * 文法は以下
 * CONSTRAINT [<制約名>] FOREIGN KEY ...
 */
function parseConstraint(table) {
    let word = INPUT_TEXT.next();

    // 制約名が来たら1つ消費
    if (word.indexOf('FOREIGN') == -1) {
        word = INPUT_TEXT.next();
    };

    if (word.indexOf('FOREIGN') != -1) {
        if (INPUT_TEXT.next().indexOf('KEY') != -1) {
            parseForeignKey(table);
        }
    }
}

/*
 * CREATE文をパースする関数
 * TABLE_MAPに結果を追加する
 *
 * 文法は以下
 * TABLE <tableName>(<columnName> ... CONSTRAINT);
 */
function parseCreate() {
    if (INPUT_TEXT.next().indexOf('TABLE') == -1) return;
    let tableName = removeBackQuote(INPUT_TEXT.next());
    if (tableName.indexOf('(') != -1) {
        tableName = tableName.slice(0, tableName.indexOf('('));
    }

    let table = new Table(tableName);
    TABLE_MAP.set(tableName, table);

    while (true) {
        let word = INPUT_TEXT.next();
        if (word.indexOf('CONSTRAINT') != -1) parseConstraint(table);
        if (word.indexOf(';') != -1) break;
    }
}

/*
 * ALTER文をパースする関数
 *
 * 文法は以下
 * TABLE <tableName> ADD [CONSTRAINT <制約名>] FOREIGN KEY
 */
function parseAlter() {
    if (INPUT_TEXT.next().indexOf('TABLE') == -1) return;
    let tableName = removeBackQuote(INPUT_TEXT.next());
    let table = TABLE_MAP.get(tableName);

    if (INPUT_TEXT.next().indexOf('ADD') == -1) return;

    let word = INPUT_TEXT.next();
    // 制約名が来たら1つ消費
    if (word.indexOf('CONSTRAINT') != -1) {
        INPUT_TEXT.next(); // 制約名
    };

    if (word.indexOf('FOREIGN') != -1) {
        if (INPUT_TEXT.next().indexOf('KEY') != -1) {
            parseForeignKey(table);
        }
    }
}

/*
 * DDLをパースする関数
 */
function parse(text) {
    INPUT_TEXT = new InputText(text);
    while(INPUT_TEXT.hasNext()) {
        let word = INPUT_TEXT.next();
        if (word.indexOf('CREATE') != -1) parseCreate();
        if (word.indexOf('ALTER') != -1) parseAlter();
    }

    // showForEach(TABLE_MAP);

    createTableCheckBoxDom();
}

/*
 * TABLE_MAPを元にページの「2.テーブル選択」を作る関数
 */
function createTableCheckBoxDom() {
    let tableCheckboxForm = document.tableCheckboxForm;
    TABLE_MAP.forEach(table => {
        let checkbox = document.createElement('input');
        checkbox.setAttribute('type', 'checkbox');
        checkbox.setAttribute('name', 'table');
        checkbox.setAttribute('value', table.name);
        tableCheckboxForm.appendChild(checkbox);

        let tableNameText = document.createTextNode(table.name);
        tableCheckboxForm.appendChild(tableNameText);

        let br = document.createElement('br');
        tableCheckboxForm.appendChild(br);
    });
}

/*
 * ページの「2.テーブル選択」でチェックされているテーブル名を取得する関数
 */
function getCheckedTableNames() {
    let tableCheckboxEntries = document.tableCheckboxForm.table;
    let checkedTableNameArray = [];
    for (let i = 0; i < tableCheckboxEntries.length; i++) {
        if (tableCheckboxEntries[i].checked) {
            checkedTableNameArray.push(tableCheckboxEntries[i].value);
        }
    }
    return checkedTableNameArray;
}

/*
 * tableに関係する他のテーブルを集めてrequiredTablesに入れていく関数
 * 再帰で集める
 * 循環参照には未対応
 */
function gatherTables(requiredTables, table) {
    table.references.forEach(reference => {
        let refTable = TABLE_MAP.get(reference.refTableName);
        requiredTables.set(reference.refTableName, refTable);
        gatherTables(requiredTables, refTable);
    });
}

/*
 * resultTablesに含まれるテーブルのテーブル名や列名を
 * アッパーキャメルケースに変換する関数
 */
function convertResultNameCases(resultTables) {
    resultTables.forEach(table => {
        table.name = convertUpperCamelCase(table.name);
        table.references.forEach(ref => {
            ref.tableName = convertUpperCamelCase(ref.tableName);
            ref.refTableName = convertUpperCamelCase(ref.refTableName);

            let columns = new Array();
            ref.columns.forEach(column => {
                columns.push(convertUpperCamelCase(column));
            });
            ref.columns = columns;

            columns = new Array();
            ref.refColumns.forEach(column => {
                columns.push(convertUpperCamelCase(column));
            });
            ref.refColumns = columns;
        });
    });
}

/*
 * スネークケースをアッパーキャメルケースに変換する関数
 */
function convertUpperCamelCase(name) {
    name = name.toLowerCase();
    let words = name.split('_');
    let result = '';
    words.forEach(word => {
        result += word.charAt(0).toUpperCase() + word.slice(1);
    });
    return result;
}

/*
 * delete可能な順序でテーブル名を列挙した文字列を作る関数
 */
function genDeleteTableCode(resultTables) {
    let result = "// delete tables<br>"
    for (let i = resultTables.length-1; i != -1; i--) {
        result += resultTables[i].name + "<br>";
    }
    return result;
}

/*
 * insert可能な順序でテーブルのEntityを列挙した文字列を作る関数
 * 外部キーの値をセットするコードも一緒に作る
 */
function genInsertJavaCode(resultTables) {
    let result = "// insert entities<br>"
    resultTables.forEach(table => {
        result += table.name + "Entity "
                + "insert" + table.name + "Entity"
                + " = new " + table.name + "Entity();<br>";

        table.references.forEach(ref => {
            let begin = "insert" + ref.tableName + "Entity";
            for (let i = 0; i < ref.columns.length; i++) {
                result += begin
                    + ".set" + ref.columns[i] + "("
                    + "insert" + ref.refTableName + "Entity"
                    + ".get" + ref.refColumns[i] + "());<br>";
            }
        });

        result += "// insert" + table.name + "Entity<br><br>";
    });
    return result;
}

/*
 * checkedTableNameArrayに含まれるテーブルから
 * 外部キー制約を考慮してソートした配列を作る関数
 *
 * 制約が無い順番にソートしてもつ（つまり挿入可能な順序）
 */
function analyzeForeginKey(checkedTableNameArray) {
    // ページでチェックされたテーブルに関係するテーブルを集める
    let requiredTables = new Map();
    for (let i = 0; i < checkedTableNameArray.length; i++) {
        let tableName = checkedTableNameArray[i];
        let table = TABLE_MAP.get(tableName);
        requiredTables.set(tableName, table);
        try {
            gatherTables(requiredTables, table);
        } catch (e) {
            let msg = '';
            if (e instanceof RangeError) {
                msg = '循環参照があります。\n';
            }

            msg += e.name + '\n'
                + e.message + '\n\n'
                + 'ページをリロードします。';
            if (!alert(msg)) location.reload();
            return null;
        }
    }

    // requiredTablesを外部キー制約を考慮してソートした配列
    // 制約が無い順番にソートしてもつ（つまり挿入可能な順序）
    let resultTables = []; 

    // resultTablesのテーブル名だけを持つ配列
    // 外部キー制約を考慮するときのみに使用する。あると便利だから。
    let resultTableNames = [];

    // requiredTablesから外部キーを持たないテーブルをresultTablesに加える
    requiredTables.forEach(table => {
        if (table.references.length == 0) {
            resultTables.push(table);
            resultTableNames.push(table.name);
        }
    });
    resultTables.forEach(table => {
        // 加えたテーブルはrequiredTablesから削除
        requiredTables.delete(table.name);
    });

    //showForEach(requiredTables);

    // 外部キーを考慮してrequiredTablesから既に
    // resultTablesにあるテーブルを順に追加する
    while (true) {
        requiredTables.forEach(requiredTable => {
            let flag = true; // resultTableに参照先テーブルが全てある場合はtrue
            for (let i = 0; i < requiredTable.references.length; i++) {
                if (!resultTableNames.includes(requiredTable.references[i].refTableName)) {
                    flag = false;
                    break;
                }
            }
            if (flag) {
                resultTables.push(requiredTable);
                resultTableNames.push(requiredTable.name);
                requiredTables.delete(requiredTable.name);
            }
        });
        if (requiredTables.size == 0) break;
    }

    return resultTables;
}

/*
 * ページの「3.Javaコード生成」で呼ばれる関数
 * ページの「4.Javaコード」に表示するコードを作る関数
 * 依存関係を考慮してソートしたresultTables配列も作る
 */
function genJavaCode() {
    if (EXECUTED_FLAG) {
        if(!alert("「1.ddlファイルオープン」からやり直してください。\nページをリロードします。")) {
            location.reload();
        }
        return;
    }
    EXECUTED_FLAG = true;

    let checkedTableNameArray = getCheckedTableNames()
    //showForEach(checkedTableNameArray);

    let resultTables = analyzeForeginKey(checkedTableNameArray);
    if (resultTables == null) return;
    //showForEach(resultTables);

    convertResultNameCases(resultTables);
    let cleanJavaCode = genDeleteTableCode(resultTables);
    let insertJavaCode = genInsertJavaCode(resultTables);

    let result = cleanJavaCode + "<br>" + insertJavaCode;

    document.getElementById("result").innerHTML = result;
}

init();
